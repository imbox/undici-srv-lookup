import { Resolver } from 'node:dns/promises'
import { interceptors } from 'undici'

export default function createSrvLookup (
  resolver?: Resolver
): interceptors.DNSInterceptorOpts['lookup']
