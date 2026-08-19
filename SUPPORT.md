# Gapwise Support

Gapwise for UTM is an independent student project. It is not affiliated with, endorsed by, or an official service of the University of Toronto.

## Product help

For non-sensitive bugs, setup problems, timetable-import issues, routing/data corrections, or feature questions, open an issue in the public [Gapwise GitHub repository](https://github.com/andrewmuratov/gapwise/issues) and include:

- what you were trying to do;
- the affected Gapwise page or feature;
- browser/device information when relevant;
- clear reproduction steps using non-sensitive data;
- screenshots only after removing timetable details, names, tokens, account identifiers, or other private information.

Do not post ACORN `.ics` files, OAuth credentials, access/refresh tokens, private timetable contents, encryption keys, or another person's data in a public issue.

## Gapwise AI / connector help

For connector issues, include the AI client (for example Claude), whether the issue affects public campus tools or your explicitly delegated private timetable tools, and the error message with all tokens/private timetable content removed.

If private Gapwise AI access is behaving unexpectedly, revoke AI access from **Gapwise Account → AI** while investigating. Revocation is designed to remove the delegated AI snapshot/actions and stop subsequent private tool access.

If Claude shows an outdated tool list after a Gapwise MCP release, disconnect and re-add the custom Gapwise connector, then re-authenticate. This refreshes client-side connector metadata.

## Security reports

Do not disclose exploitable vulnerabilities publicly. Follow [`SECURITY.md`](SECURITY.md) and use GitHub private vulnerability reporting when available.

## University services

For official academic records, registration, university policy, accessibility accommodations, emergencies, or other matters that require an authoritative University of Toronto answer, use the appropriate official university service. Gapwise recommendations and campus-route data are not an official U of T determination.
