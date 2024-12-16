'use strict'
const { Resolver } = require('node:dns/promises')
const { callbackify } = require('node:util')

module.exports = function createSrvLookup (resolver = new Resolver()) {
  return callbackify(async (origin, opts) => {
    const srvs = await resolver.resolveSrv(origin.hostname)
    if (srvs.length === 0) {
      return []
    }

    const addresses = []
    const errors = []
    await Promise.all(
      srvs.map(async (srv) => {
        try {
          const records = await resolver.resolve4(srv.name, { ttl: true })
          for (const record of records) {
            addresses.push({
              address: record.address,
              family: 4,
              port: srv.port,
              ttl: record.ttl ?? opts.maxTTL,
            })
          }
        } catch (err) {
          if (!err.message.includes('ENODATA')) {
            errors.push(err)
          }
        }
      })
    )

    if (addresses.length === 0 && errors.length > 0) {
      throw new AggregateError(errors)
    }

    return addresses
  })
}
