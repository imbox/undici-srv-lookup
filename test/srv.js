'use strict'
const assert = require('node:assert/strict')
const { once } = require('node:events')
const http = require('node:http')
const { test, after } = require('node:test')
const { Agent, interceptors } = require('undici')
const createSrvLookup = require('../')

test('lookup', async t => {
  const server = http.createServer()
  server.on('request', (req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('hello')
  })
  server.listen(0)
  await once(server, 'listening')

  const resolver = {
    async resolveSrv (hostname) {
      if (hostname !== 'random-address.se') {
        throw new Error('unexpected hostname: ' + hostname)
      }
      return [
        {
          name: '1.random-address.se',
          port: server.address().port
        }
      ]
    },
    async resolve4 (hostname, opts) {
      if (hostname !== '1.random-address.se') {
        throw new Error('unexpected hostname: ' + hostname)
      }
      return [{
        address: '127.0.0.1',
        ttl: 10
      }]
    }
  }

  const client = new Agent().compose([
    interceptors.dns({
      dualStack: false,
      affinity: 4,
      lookup: createSrvLookup({ resolver })
    })
  ])

  after(async () => {
    await client.close()
    server.close()
    await once(server, 'close')
  })

  const response = await client.request({
    origin: 'http://random-address.se',
    method: 'GET',
    path: '/',
    headers: {
      'content-type': 'text/plain'
    }
  })
  assert.equal(response.statusCode, 200)

  const body = await response.body.text()
  assert.equal(body, 'hello')
})

test('dedupe: false', async () => {
  const server = http.createServer()
  server.on('request', (req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('hello')
  })
  server.listen(0)
  await once(server, 'listening')

  let resolverCount = 0
  const resolver = {
    async resolveSrv (hostname) {
      resolverCount++
      if (hostname !== 'random-address.se') {
        throw new Error('unexpected hostname: ' + hostname)
      }
      return [
        {
          name: '1.random-address.se',
          port: server.address().port
        }
      ]
    },
    async resolve4 (hostname, opts) {
      if (hostname !== '1.random-address.se') {
        throw new Error('unexpected hostname: ' + hostname)
      }
      return [{
        address: '127.0.0.1',
        ttl: 10
      }]
    }
  }

  const client = new Agent().compose([
    interceptors.dns({
      maxTTL: 5,
      dualStack: false,
      affinity: 4,
      lookup: createSrvLookup({ resolver, dedupe: false })
    })
  ])

  after(async () => {
    await client.close()
    server.close()
    await once(server, 'close')
  })

  const responses = await Promise.all([
    client.request({
      origin: 'http://random-address.se',
      method: 'GET',
      path: '/',
      headers: {
        'content-type': 'text/plain'
      }
    }),
    client.request({
      origin: 'http://random-address.se',
      method: 'GET',
      path: '/',
      headers: {
        'content-type': 'text/plain'
      }
    })
  ])
  assert.equal(responses[0].statusCode, 200)
  assert.equal(responses[1].statusCode, 200)

  assert.equal(await responses[0].body.text(), 'hello')
  assert.equal(await responses[1].body.text(), 'hello')

  assert.equal(resolverCount, 2)
})

test('dedupe: true', async () => {
  const server = http.createServer()
  server.on('request', (req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('hello')
  })
  server.listen(0)
  await once(server, 'listening')

  let resolverCount = 0
  const resolver = {
    async resolveSrv (hostname) {
      resolverCount++
      if (hostname !== 'random-address.se') {
        throw new Error('unexpected hostname: ' + hostname)
      }
      return [
        {
          name: '1.random-address.se',
          port: server.address().port
        }
      ]
    },
    async resolve4 (hostname, opts) {
      if (hostname !== '1.random-address.se') {
        throw new Error('unexpected hostname: ' + hostname)
      }
      return [{
        address: '127.0.0.1',
        ttl: 10
      }]
    }
  }

  const client = new Agent().compose([
    interceptors.dns({
      maxTTL: 5,
      dualStack: false,
      affinity: 4,
      lookup: createSrvLookup({ resolver, dedupe: true })
    })
  ])

  after(async () => {
    await client.close()
    server.close()
    await once(server, 'close')
  })

  const responses = await Promise.all([
    client.request({
      origin: 'http://random-address.se',
      method: 'GET',
      path: '/',
      headers: {
        'content-type': 'text/plain'
      }
    }),
    client.request({
      origin: 'http://random-address.se',
      method: 'GET',
      path: '/',
      headers: {
        'content-type': 'text/plain'
      }
    })
  ])
  assert.equal(responses[0].statusCode, 200)
  assert.equal(responses[1].statusCode, 200)

  assert.equal(await responses[0].body.text(), 'hello')
  assert.equal(await responses[1].body.text(), 'hello')

  assert.equal(resolverCount, 1)
})

test('dedupe: true - error is catched', async () => {
  const server = http.createServer()
  server.on('request', (req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('hello')
  })
  server.listen(0)
  await once(server, 'listening')

  const resolver = {
    async resolveSrv (hostname) {
      throw new Error('test error')
    }
  }

  const client = new Agent().compose([
    interceptors.dns({
      maxTTL: 5,
      dualStack: false,
      affinity: 4,
      lookup: createSrvLookup({ resolver, dedupe: true })
    })
  ])

  after(async () => {
    await client.close()
    server.close()
    await once(server, 'close')
  })

  assert.rejects(client.request({
    origin: 'http://random-address.se',
    method: 'GET',
    path: '/',
    headers: {
      'content-type': 'text/plain'
    }
  }))
})
