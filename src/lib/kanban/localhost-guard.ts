import { NextRequest, NextResponse } from 'next/server'

const LOCALHOST_ONLY_ERROR = 'Execution runtime endpoints are restricted to localhost'
const IPV4_SEGMENT_PATTERN = /^\d{1,3}$/

export function ensureLocalhostRequest(request: NextRequest): NextResponse | null {
    if (isLocalhostRequest(request)) {
        return null
    }

    return NextResponse.json(
        { error: LOCALHOST_ONLY_ERROR },
        { status: 403 },
    )
}

function isLocalhostRequest(request: NextRequest): boolean {
    if (!isLoopbackHost(normalizeHostToken(request.nextUrl.hostname))) {
        return false
    }

    const hostHeader = request.headers.get('host')
    if (hostHeader) {
        const hostToken = extractHostToken(hostHeader)
        if (!isLoopbackHost(hostToken)) {
            return false
        }
    }

    const forwardedHostHeader = request.headers.get('x-forwarded-host')
    if (forwardedHostHeader) {
        const forwardedHostsAreLocal = splitHeaderValues(forwardedHostHeader).every((entry) =>
            isLoopbackHost(extractHostToken(entry))
        )

        if (!forwardedHostsAreLocal) {
            return false
        }
    }

    const forwardedForHeader = request.headers.get('x-forwarded-for')
    if (forwardedForHeader) {
        const forwardedAddressesAreLocal = splitHeaderValues(forwardedForHeader).every((entry) =>
            isLoopbackAddress(extractAddressToken(entry))
        )

        if (!forwardedAddressesAreLocal) {
            return false
        }
    }

    return true
}

function splitHeaderValues(value: string): string[] {
    return value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
}

function extractHostToken(value: string): string {
    const token = value.trim()
    if (token.length === 0) {
        return ''
    }

    if (token.startsWith('[')) {
        const closingBracketIndex = token.indexOf(']')
        if (closingBracketIndex > 0) {
            return normalizeHostToken(token.slice(1, closingBracketIndex))
        }
    }

    const colonCount = token.split(':').length - 1
    if (colonCount === 1) {
        const separatorIndex = token.indexOf(':')
        return normalizeHostToken(token.slice(0, separatorIndex))
    }

    return normalizeHostToken(token)
}

function extractAddressToken(value: string): string {
    let token = value.trim()
    if (token.length === 0) {
        return ''
    }

    token = token.replace(/^for=/i, '').replace(/^"|"$/g, '')

    if (token.startsWith('[')) {
        const closingBracketIndex = token.indexOf(']')
        if (closingBracketIndex > 0) {
            return normalizeHostToken(token.slice(1, closingBracketIndex))
        }
    }

    const lastColonIndex = token.lastIndexOf(':')
    if (
        token.includes('.')
        && lastColonIndex > -1
        && IPV4_SEGMENT_PATTERN.test(token.slice(lastColonIndex + 1))
    ) {
        token = token.slice(0, lastColonIndex)
    }

    return normalizeHostToken(token)
}

function normalizeHostToken(value: string): string {
    const token = value.trim().toLowerCase()
    if (token.startsWith('[') && token.endsWith(']')) {
        return token.slice(1, -1)
    }
    return token
}

function isLoopbackHost(value: string): boolean {
    if (value === 'localhost') {
        return true
    }

    return isLoopbackAddress(value)
}

function isLoopbackAddress(value: string): boolean {
    if (value === '::1' || value === '0:0:0:0:0:0:0:1') {
        return true
    }

    if (value.startsWith('::ffff:')) {
        return isLoopbackIpv4(value.slice('::ffff:'.length))
    }

    return isLoopbackIpv4(value)
}

function isLoopbackIpv4(value: string): boolean {
    const segments = value.split('.')
    if (segments.length !== 4) {
        return false
    }

    const octets: number[] = []
    for (const segment of segments) {
        if (!IPV4_SEGMENT_PATTERN.test(segment)) {
            return false
        }

        const octet = Number(segment)
        if (!Number.isInteger(octet) || octet < 0 || octet > 255) {
            return false
        }

        octets.push(octet)
    }

    return octets[0] === 127
}
