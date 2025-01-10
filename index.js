'use strict'
const { Resolver } = require('node:dns/promises')
const { performance } = require('node:perf_hooks')
const { callbackify } = require('node:util')

module.exports = function createSrvLookup ({ resolver = new Resolver(), logger = null } = {}) {
  return callbackify(async (origin, opts) => {
    let start
    if (logger) {
      start = performance.now()
    }
    const srvs = await resolver.resolveSrv(origin.hostname)
    if (srvs.length === 0) {
      logger?.debug('%s resolved no srvs', origin.hostname)
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
              ttl: record.ttl ? record.ttl * 1_000 : opts.maxTTL,
            })
          }
        } catch (err) {
          if (!err.message.includes('ENODATA')) {
            errors.push(err)
          }
        }
      })
    )

    if (logger) {
      const duration = performance.now() - start
      logger.debug(`${origin.hostname} resolved (${duration.toFixed(3)} ms) srvs %o\naddresses: %o`, srvs, addresses)
    }

    if (addresses.length === 0 && errors.length > 0) {
      throw new AggregateError(errors)
    }

    return addresses
  })
}
