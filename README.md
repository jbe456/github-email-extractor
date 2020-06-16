## Github email extractor

Extract Github user emails and names from Github repositories and export them as CSV files.

Features:

- Get Github rate limit status
- Extract name from owner, stargazers, watchers, issues, forks & comments
- Extract emails from user profile and push events.
- Extract name & emails from a list of multiple repositories
- Extract name & emails from all repositories matching a Github search query like "topic:analysis language:python"
- Uses a file system cache so that you can:
  - grab data from repos containing several thousands of users with multiple trials
  - safely retry any command without wasting Github API calls

### CLI

```console
> gee --help
gee status --help
gee extract --help

Commands:
  gee status   Get Github rate limit status
  gee extract  Extract Github user emails and names from one or multiple
               repositories

Options:
  --version       Show version number                                  [boolean]
  --clientId      Github app client id                                  [string]
  --clientSecret  Github app client secret                              [string]
  --help          Show help                                            [boolean]

Examples:
  gee status                                Get default Github rate limit status
  gee status --clientId XX --clientSecret   Get authenticated Github rate limit
  YY                                        status
  gee extract --clientId XX --clientSecret  Extract user names & emails from a
  YY --repos ownerA/repoA                   single repository
  gee extract --clientId XX --clientSecret  Extract user names & emails from
  YY --repos ownerA/repoA ownerB/repoB      multiple repositories and export all
  --output ZZ                               results under specified folder
  gee extract --clientId XX --clientSecret  Extract user names & emails from
  YY --query 'topic:analysis                repositories whose topic and
  language:python' --output                 language matches the query and
  analysis-python.csv                       export all results into one file

```

#### status

```console
> gee status --help
gee status

Get Github rate limit status

Options:
  --version       Show version number                                  [boolean]
  --clientId      Github app client id                                  [string]
  --clientSecret  Github app client secret                              [string]
  --help          Show help                                            [boolean]
```

#### extract

```console
> gee extract --help
gee extract

Extract Github user emails and names from one or multiple repositories

Options:
  --version       Show version number                                  [boolean]
  --clientId      Github app client id                                  [string]
  --clientSecret  Github app client secret                              [string]
  --help          Show help                                            [boolean]
  --repos         A list of space-separated repositories to extract emails from
                                                                         [array]
  --query         A Github search query to select repositories to extract emails
                  from                                                  [string]
  --output        Destination folder where CSV results are exported, relative or
                  absolute path. If a output points to a file, will export all
                  results to one file only                              [string]
  --maxEmails     Maximum number of emails to extract per Github user.
                                                           [number] [default: 2]
  --cacheExpiry   Number of days before cache entities expire.
                                                          [number] [default: 31]
  --cachePath     Path to the cache folder.      [number] [default: "gee-cache"]
```

### Troubleshoot

#### Abuse detection mechanism

```
RequestError [HttpError]: You have triggered an abuse detection mechanism. Please wait a few minutes before you try again.
```

This error is triggered by Github when too many requests are triggered in a short time period. Check the `retry-after` header to know how many seconds needs to pass before triggering new API requests.

#### API rate limit exceeded

```
RequestError [HttpError]: API rate limit exceeded for app ID XXXX.
```

This error is triggered by Github when rate limit has been exceeded. Check the `x-ratelimit-reset` header or use the `status` command to know when the rate limit will be reset.
