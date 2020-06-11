### Github email extractor

Extract Github user emails and names from a specific repository and store them as CSV files.

#### CLI

```console
> gee --help
Extract Github user emails and names from one or multiple repositories.

Usage:
  # Get default Github rate limit status
  gee status
  # Get authenticated Github rate limit status
  gee status --clientId XX --clientSecret YY
  # Extract user names & emails from ownerA/repoA
  gee extract --clientId XX --clientSecret YY --repos ownerA/repoA
  # Extract user names & emails from ownerA/repoA & ownerB/repoB
  # and export results into folder 'ZZ'
  gee extract --clientId XX --clientSecret YY --repos ownerA/repoA ownerB/repoB
  --output ZZ

Commands:
  gee status   Get Github rate limit status
  gee extract  Extract emails from one or multiple github repos

Options:
  --version       Show version number                                  [boolean]
  --clientId      Github app client id                                  [string]
  --clientSecret  Github app client secret                              [string]
  --help          Show help                                            [boolean]
```

```console
> gee extract --help
gee extract

Extract emails from one or multiple github repos

Options:
  --version       Show version number                                  [boolean]
  --clientId      Github app client id                                  [string]
  --clientSecret  Github app client secret                              [string]
  --help          Show help                                            [boolean]
  --repos         A list of space-separated repositories to extract emails from
                                                              [array] [required]
  --output        Destination folder where CSV results are exported, relative or
                  absolute path                                         [string]
  --maxEmails     Maximum number of emails to extract per Github user.
                                                           [number] [default: 2]
  --cacheExpiry   Number of days before cache entities expire.
                                                          [number] [default: 31]
  --cachePath     Path to the cache folder.      [number] [default: "gee-cache"]
```
