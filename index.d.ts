import { Resolver } from 'node:dns/promises'
import { Logger } from 'pino'
import { interceptors } from 'undici'

export default function createSrvLookup (
  opts?: { resolver?: Resolver, logger?: Logger }
): interceptors.DNSInterceptorOpts['lookup']
