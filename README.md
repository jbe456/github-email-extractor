### Github email extractor

Extract Github user emails and names from a specific repository and store them as CSV files.

#### CLI

```console
Extract Github user emails and names from a specific repository.

Example:
gee status
gee status --clientId XX --clientSecret YY
gee extract --clientId XX --clientSecret YY --repo jbe456/github-email-extractor

Commands:
  gee status   Get Github rate limit status
  gee extract  Extract emails from a github repo

Options:
  --version       Show version number                                  [boolean]
  --clientId      Github app client id                                  [string]
  --clientSecret  Github app client secret                              [string]
  --help          Show help                                            [boolean]
```
