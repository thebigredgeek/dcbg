# Docker Cloud Blue/Green command-line tool
Simple command line tool to resolve the next active target code for blue/green deployments on docker cloud

# Installation

    $ npm install -g dcbg

# Usage

```bash
dcbg
  --help                        Prints guide
  --user=[username]             Docker cloud username.
  --token=[token]               Docker cloud API token associated with the username.
  --target=[service].[stack]    The docker cloud internal domain name for the service in question.
  --lb=[loadbalancer]           The docker cloud hostname for the loadbalancer.  Must be on target stack.
  --options=(blue,green)        (optional) The suffix codes used for the service.  Defaults to blue,green
  --active                      (optional) Flag to return active code rather than next code
```
