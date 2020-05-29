# Spring Health Pivotal Helper
### Features
1. Pivotal Tracker 

### Configuration Options
1. Must be run `on: [pull_request]`

### Sample Configuration:

```yml
name: Spring Health Pivotal Helper

on:
  pull_request:
    types: [closed]

jobs:
  Pivotal Helper:
    runs-on: ubuntu-latest
    steps:
    - uses: 'SpringCare/actions/dist/pivotal_helper@master'
      with:
        repo-token: ${{ secrets.GITHUB_TOKEN }}
        pivotal-api-key: ${{ secrets.PIVOTAL_API_KEY }}
      if: github.event.pull_request.merged == true
```