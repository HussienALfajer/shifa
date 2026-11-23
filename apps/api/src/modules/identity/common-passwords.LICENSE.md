# Bundled common-password list

`common-passwords.json` (A-01a criterion 8) holds the entries of 10 or more printable ASCII characters among the first 20,000 lines of the UK National Cyber Security Centre's list of the 100,000 most used passwords, lower-cased and de-duplicated: 1,784 entries. Shorter entries are left out because the 10-character minimum refuses them anyway.

- Source: NCSC "PwnedPasswordsTop100k" (2019), as published in SecLists, `Passwords/Common-Credentials/100k-most-used-passwords-NCSC.txt`, fetched 2026-11-23.
- Licences: the NCSC list is Crown copyright, published under the Open Government Licence v3.0 (https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/); SecLists is distributed under the MIT License, Copyright (c) 2018 Daniel Miessler.
- The entries are public password-corpus strings, not data about any person of this project.

Order carries no meaning (the API loads a set). `password01` sits at the end: in list order it is followed by a random-looking entry, which gitleaks' generic rule reads as a password assignment.

To refresh: take the same file, keep lines 1–20,000 of 10+ characters, lower-case, de-duplicate in order, and update the date above.
