/**
 * node scripts/generate-vapid-keys.js
 * Prints a fresh VAPID key pair to paste into .env.local. These are what let
 * JunkRun send real browser/OS push notifications without a third-party
 * push provider — the public key is safe to expose, the private key is not.
 */
const webpush = require('web-push')
const keys = webpush.generateVAPIDKeys()
console.log('# Paste these into .env.local')
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`)
