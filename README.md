## Github email extractor

Extract Github user emails and names from Github repositories and export them as CSV files. Make sure you've read [Github's terms of service and privacy statement](#github-terms-of-service-and-privacy-statement) before using this tool.

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

### Github terms of service and privacy statement

From Github's [terms of service](https://help.github.com/en/github/site-policy/github-terms-of-service#h-api-terms):

> API Terms
>
> Abuse or excessively frequent requests to GitHub via the API may result in the temporary or permanent suspension of your Account's access to the API. GitHub, in our sole discretion, will determine abuse or excessive usage of the API. We will make a reasonable attempt to warn you via email prior to suspension.
>
> You may not share API tokens to exceed GitHub's rate limitations.
>
> You may not use the API to download data or Content from GitHub for spamming purposes, including for the purposes of selling GitHub users' personal information, such as to recruiters, headhunters, and job boards.
>
> All use of the GitHub API is subject to these Terms of Service and the GitHub Privacy Statement.

From Githubs's [privacy statement](https://help.github.com/en/github/site-policy/github-privacy-statement#public-information-on-github):

> Public information on GitHub
>
> Many of GitHub services and features are public-facing. If your content is public-facing, third parties may access and use it in compliance with our Terms of Service, such as by viewing your profile or repositories or pulling data via our API. We do not sell that content; it is yours. However, we do allow third parties, such as research organizations or archives, to compile public-facing GitHub information. Other third parties, such as data brokers, have been known to scrape GitHub and compile data as well.
>
> Your User Personal Information associated with your content could be gathered by third parties in these compilations of GitHub data. [...]
>
> If you would like to compile GitHub data, you must comply with our Terms of Service regarding scraping and privacy, and you may only use any public-facing User Personal Information you gather for the purpose for which our user authorized it. For example, where a GitHub user has made an email address public-facing for the purpose of identification and attribution, do not use that email address for commercial advertising. We expect you to reasonably secure any User Personal Information you have gathered from GitHub, and to respond promptly to complaints, removal requests, and "do not contact" requests from GitHub or GitHub users.
>
> Similarly, projects on GitHub may include publicly available User Personal Information collected as part of the collaborative process. If you have a complaint about any User Personal Information on GitHub, please see our section on resolving complaints.
