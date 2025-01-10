import { expectType } from 'tsd'
import { Resolver } from 'node:dns/promises'
import { interceptors } from 'undici'
import createSrvLookup from '../../'

expectType<interceptors.DNSInterceptorOpts['lookup']>(
  createSrvLookup()
)
expectType<interceptors.DNSInterceptorOpts['lookup']>(
  createSrvLookup({ resolver: new Resolver() })
)
