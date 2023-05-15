# Zod + Pbf based object encoder

***WORK IN PROGESS/EXPERIMENT***

Compactly encode/decode objects defined in zod types into `protobuf` based binary format.

```js
const valueSchema = z.object({
  x: z.string(),
  y: z.array(z.number()).optional()
})
const value = { x: 'y', y: [1,2,3] }

const [encoded, length] = encodeZodPbfCompact(value, valueSchema)
// encoded is Uint8Array, with <length> significant bytes
const valueDecoded = decodeZodPbfCompact(encoded, valueSchema)
```
## Completness status

Only these types are supported as for now:
* primitives: `ZodUndefined`, `ZodNull`, `ZodLiteral`, `ZodBoolean`, `ZodNumber`, `ZodString`
* basic JS compounds: `ZodObject`, `ZodArray`
* typed compounds: `ZodOptional`, `ZodUnion`


## Usage

CommonJS mode:
```js
const { decodeZodPbfCompact } = require("zod-pbf");
const { encodeZodPbfCompact } = require("zod-pbf/lib/encodeZodPbfCompact.js");
```

ESM mode:

```js
import { decodeZodPbfCompact } from "zod-pbf";
import { encodeZodPbfCompact } from "zod-pbf/lib/encodeZodPbfCompact.js";
```


## Compact mode

***Warning***: Compact is _very_ fragile to changes in types.

This is like C struct. No metadata about types/sizes at all.
Receiving type must be strict base type of type ends must use exactly the same type definitions!

```js
const valueSchema = z.object(...)
const value = { x: 'y' }

const [encoded, length] = encodeZodPbfCompact(value, valueSchema)
const valueDecoded = decodeZodPbfCompact(payload, valueSchema)
```

The only mutations allowed are:

* adding new field ***at the end*** of top object:
  ```diff
   type Message {
     y: string
     x: Options
  +  z: number // good
   }
  ```

     * adding field to embedded message will cause undefined behavior when decoding
       ```diff
        type Message {
          id: string
          user: {
            name: string
       +    surname: string // bad!
          }
          age?: number
        }
       ```

* if top type is (discriminated ?) union, then adding new type (at end of type sum) - unknown to decoder
  - will deterministically throw exception in decoder, as it will detect unknown union tag and throw `incompatible payload (invalid union tag: <number>)`
  - this may be useful to prepare design top level protocol like this:
    ```ts
    type Message = MessageA | MessageB | MessageC
    // and then extend it in next iteration of sender:
    type Message = MessageA | MessageB | MessageC | MessageNew
    ```
    this design is forward compatible, as it allows adding new entities to protocol in a way
    that old decoder will be able detect unknown union tags and will not attempt to decode them but just throw `incompatible payload ...` error

* extending enum that was already in place ia allowed:
  ```diff
   enum Options {
     OldValue,
  +  NewValue // ok, assuming that app will be able to cope with unknown enum value
   }
   type Message {
     y: string
     x: Options
     z: number
   }
  ```


If any _internal_ field is added/removed/change or union is augmented deserialization result will be ***undefined***. In other words, decoder will result in ***garbage***, not even an error!

Decoder will only attempt to read as many bytes as mandated by schema, so extra bytes will be ignored.

## Forward compatible encoding

TODO: assuming that backward/forward compatibility of protocol is important it's probably needed to design/reuse some existing encodings that allow more
changes in types, like BER/protobuf.

## Protobuf compatibility mode

Protobuf is much more limited than typescript - `encodeZodProtobuf` will throw if schema is not compatible with protobuf (proto3)?

TODO

## BER/DER/PER mode ?

TODO: does it make sense to revive those old things?
It's not PBF anymore .... possibly completly different project ...

It would be great to create proper, JS-only automated X.509 encoders/decoders created from TS/ZOD schema.

Of course, there are already things like
 * https://github.com/indutny/asn1.js/ which works on top of ASN.1 schema so basically the same, but without TS integration
 *

## Random notes / material

```
- type Payload = PayloadInit | PayloadMsg
+ type Payload = PayloadInit | PayloadMsg | PayloadNotify
```

That means,
 * it is possible to extend root object type by adding new fields or union alternatives, they will be ignored when decoding as long as additions are always happening at end of type
 * decoding is possible only if encoder type was extended only at root object level v.r.t to decoding type.


Even field order or union alternatives order is important.

The only practical solution is app with
* very strict version requirements or
* same-app worker/subprocess communcation or
* if there are more apps with different deployment lifecycles you need to ensure additional protocol to check that types used are exactly same.

