# Zod + Pbf based object encoder


## Strict mode

***Warning***: Strict mode doesn't support any backward/forward compatibility and is experiment probably without any practical means.

```js
const valueSchema = z.object(...)
const value = { x: 'y' }

const valueEncoded = encodeZodPbfStrict(value, valueSchema)[0]
const valueDecoded = decodeZodPbfStrict(payload, valueSchema)
```


That means, both encoder and decoder part must use exactly same Zod type info.

If any field is added/removed/change or union is augmented deserialization result will be undefined.

Even field order or union alternatives order is important.

The only practical solution is app with very strict version requirements, same-app worker/subprocess communcation and additional protocol to check that
types used are exactly same.