"""URL validation service for SSRF prevention.

Validates both hostname literals AND resolved DNS addresses.
Blocks private, loopback, link-local, metadata, and internal destinations.
"""
from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse


BLOCKED_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fe80::/10"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("::ffff:127.0.0.0/104"),
    ipaddress.ip_network("::ffff:10.0.0.0/104"),
    ipaddress.ip_network("::ffff:172.16.0.0/108"),
    ipaddress.ip_network("::ffff:192.168.0.0/112"),
]

BLOCKED_HOSTNAMES = {"localhost", "metadata.google.internal", "instance-data"}
ALLOWED_SCHEMES = {"https", "http"}
BLOCKED_PORTS = {0, 6379, 5432, 3306, 27017, 11211}


class SSRFError(Exception):
    pass


def _is_blocked_ip(addr: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    for network in BLOCKED_NETWORKS:
        if addr in network:
            return True
    return False


def validate_url(url: str) -> str:
    """Validate URL scheme, hostname, port, and IP. Returns validated URL or raises SSRFError."""
    parsed = urlparse(url)

    if parsed.scheme not in ALLOWED_SCHEMES:
        raise SSRFError(f"Unsupported URL scheme: {parsed.scheme}")

    hostname = parsed.hostname
    if not hostname:
        raise SSRFError("Missing hostname")

    if hostname.lower() in BLOCKED_HOSTNAMES:
        raise SSRFError(f"Blocked hostname: {hostname}")

    # Check if hostname is an IP literal
    try:
        addr = ipaddress.ip_address(hostname)
        if _is_blocked_ip(addr):
            raise SSRFError(f"Blocked IP address: {hostname}")
    except ValueError:
        pass  # Not an IP literal, will be resolved in resolve_and_validate()

    port = parsed.port
    if port and port in BLOCKED_PORTS:
        raise SSRFError(f"Blocked port: {port}")

    return url


def resolve_and_validate(url: str) -> tuple[str, list[str]]:
    """Resolve DNS for a URL and validate ALL resolved IPs.

    Returns (validated_url, list_of_safe_ips).
    Raises SSRFError if any resolved IP is in a blocked range.
    This prevents DNS rebinding attacks.
    """
    validate_url(url)  # Basic checks first

    parsed = urlparse(url)
    hostname = parsed.hostname
    port = parsed.port or (443 if parsed.scheme == "https" else 80)

    if not hostname:
        raise SSRFError("Missing hostname")

    # Resolve DNS
    try:
        results = socket.getaddrinfo(hostname, port, proto=socket.IPPROTO_TCP)
    except socket.gaierror as e:
        raise SSRFError(f"DNS resolution failed: {e}")

    if not results:
        raise SSRFError("DNS resolution returned no addresses")

    safe_ips: list[str] = []
    for family, _, _, _, sockaddr in results:
        ip_str = sockaddr[0]
        try:
            addr = ipaddress.ip_address(ip_str)
            if _is_blocked_ip(addr):
                raise SSRFError(f"DNS resolved to blocked address: {ip_str}")
            safe_ips.append(ip_str)
        except ValueError:
            raise SSRFError(f"Invalid resolved address: {ip_str}")

    if not safe_ips:
        raise SSRFError("No valid addresses after DNS resolution")

    return url, safe_ips
