# undici-srv-lookup

Lookup function which can be used with Undici's DNS interceptor to resolve ip
adresses via SRV records.

## Usage

```javascript
const { Agent, interceptors } = require('undici')
const createSrvLookup = require('undici-srv-lookup')
const client = new Agent().compose([
  interceptors.dns({
    dualStack: false, // currently only supports ipv4
    affinity: 4, // currently only supports ipv4
    lookup: createSrvLookup()
  })
])
```
