'use strict'
const { Resolver } = require('node:dns/promises')
const { performance } = require('node:perf_hooks')
const { callbackify } = require('node:util')

module.exports = function createSrvLookup ({
  resolver = new Resolver(),
  logger = null,
  dedupe = false
} = {}) {
  const resolve = async (url, opts) => {
    let start
    if (logger) {
      start = performance.now()
    }

    const srvs = await resolver.resolveSrv(url.hostname)
    if (srvs.length === 0) {
      logger?.debug('%s resolved no srvs', url.hostname)
      return []
    }

    const addresses = []
    const errors = []
    await Promise.all(
      srvs.map(async (srv) => {
        try {
          const records = await resolver.resolve4(srv.name, { ttl: true })
          for (const record of records) {
            const ttl = typeof record.ttl === 'number'
              ? Math.max(500, record.ttl * 1_000) // patch received ttl = 0
              : opts.maxTTL

            addresses.push({
              address: record.address,
              family: 4,
              port: srv.port,
              ttl,
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
      logger.debug(
        `${url.hostname} resolved (${duration.toFixed(3)} ms) srvs %o\naddresses: %o`,
        srvs,
        addresses
      )
    }

    if (addresses.length === 0 && errors.length > 0) {
      throw new AggregateError(errors)
    }

    return addresses
  }

  if (dedupe) {
    const cache = new Map()
    return callbackify(async (url, opts) => {
      const { origin } = url

      if (cache.has(origin)) {
        return cache.get(origin)
      }

      const promise = resolve(url, opts)
        .then(results => {
          cache.delete(origin)
          return results
        }).catch(err => {
          cache.delete(origin)
          throw err
        })

      cache.set(origin, promise)
      return promise
    })
  } else {
    return callbackify(resolve)
  }
}
