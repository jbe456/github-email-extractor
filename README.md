### Github email extractor

Extract Github user emails and names from a specific repository and store them as CSV files.

#### CLI

```console
> gee --help
Extract Github user emails and names from a specific repository.

Usage:
# Get Github rate limit status
> gee status
# Get Github rate limit status while authenticated
> gee status --clientId XX --clientSecret YY
# Extract user names & emails from jbe456/github-email-extractor
> gee extract --clientId XX --clientSecret YY --repo
jbe456/github-email-extractor
# Extract user names & emails from jbe456/github-email-extractor and export
results into folder 'ZZ'
> gee extract --clientId XX --clientSecret YY --repo
jbe456/github-email-extractor --output ZZ

Commands:
  gee status   Get Github rate limit status
  gee extract  Extract emails from a github repo

Options:
  --version       Show version number                                  [boolean]
  --clientId      Github app client id                                  [string]
  --clientSecret  Github app client secret                              [string]
  --help          Show help                                            [boolean]
```

```console
> gee extract --help
gee extract

Extract emails from a github repo

Options:
  --version       Show version number                                  [boolean]
  --clientId      Github app client id                                  [string]
  --clientSecret  Github app client secret                              [string]
  --help          Show help                                            [boolean]
  --repo          Repository to extract emails from          [string] [required]
  --output        Destination folder where CSV results are exported, relative or
                  absolute path                                         [string]
  --maxEmails     Maximum number of emails to extract per Github user.
                                                           [number] [default: 3]
```
