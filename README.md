# Carousell Message Archiver

<img width="809" alt="image" src="https://github.com/user-attachments/assets/81b85c0c-9542-4957-a00a-ce6bfd733cfd" />

This script will let you archive your messages from Carousell. This is useful especially because Carousell has a new policy where they will be **deleting messages older than one year** on April 23, 2025, and moving forward, will continue to delete messages that are older than one year.

They have said that you may [manually save your messages](https://github.com/user-attachments/assets/dd17200f-c84e-49a9-b2d1-46babfc3f81e) (or subscribe, lol) if you have anything you want to preserve, but to my knowledge, they have not provided a mass export or other means to do so. If you want to avoid taking hundreds of screenshots, and don't have need for the other features of a subscription, then this tool may be of help to you!

## How to download messages

1. Make sure you have nodejs installed on your machine.
2. Download or clone this repo locally.
3. Install the deps (`npm install`)
4. Make a copy of `config.json.template` to `config.json`
   * Edit `config.json` as necessary (see [below](#more-on-configuration) for details)
5. Run `node ./fetch_offers.js` and `node ./fetch_offer_messages.js`.
   * This will output `offers.json` and `offers_all_messages.json` by default
6. (optional) Run `node ./fetch_images.js` to download photos
   * This will output to the folder `/media`

The offers and messages output JSON will contain the raw data from Carousell's API.

## How to view messages

1. Copy `offers.json` and `offers_all_messages.json` to `/web_interface`.
2. (optional) Copy `/media` folder to `/web_interface/media`
    * If you don't have a local copy of photos, the viewer webapp will fetch them from the web (unless Carousell deletes them too 🤷)
3. Run a web server in `/web_interface`
    * You can try `python3 -m http.server` or `npx http-server`
4. open http://localhost:8000 (or wherever your server is)

## More on configuration

* `cookie` and `csrfToken`
  - You'll need to get this from your browser's devTools.
  - This gives access to your account. Keep this safe and don't share it with anyone else.
<details>
 <summary>Click to show instructions</summary>

 1. go to your carousell inbox
 2. open the browser devtools (`Ctrl + Shift + I` on windows/linux or `Cmd + Shift + I` on mac)
 3. refresh
 4. go to the `Network` tab, then filter for `Fetch/XHR`
 5. look for the entry that starts with `me`
 6. Under headers, look for **request headers**, then copy the values for cookie and CSRF token

<img width="1296" alt="SCR-20250422-shqj-" src="https://github.com/user-attachments/assets/7a628c69-2633-4373-9929-c83508bed040" />

</details>

* `sessionKey`
  - You'll need to get this from your browser's devTools.
  - this is required for the individual messages for each thread. if you don't need those and are just okay with a list of sellers/buyers/offers, you can omit this.

<details>
 <summary>Click to show instructions</summary>

 1. go to your carousell inbox
 2. open the browser devtools (`Ctrl + Shift + I` on windows/linux or `Cmd + Shift + I` on mac)
 3. open any chat thread
 4. go to the `Network` tab, then filter for `Fetch/XHR`
 5. look for the entry that starts with something like `F3CB6187-CB42-4CD1-95F...` (or similar)
 6. Under headers, look for **request headers**, then copy the value for `Session-Key`

(similar process to the cookie)

</details>

* `countryCode`
  - Where your Carousell account is based. One of: AU, CA, HK, ID, MY, NZ, PH, SG, TW
* `outputOffers`
  - Where the thread metadata and listing information will be saved.
* `outputMessages`
  - Where the individual messages for each thread will be saved.
* `pageCount`
  - How many threads to check at a time. The default is safe to leave at.
* `userAgent`
  - What identifies your specific brower. You could leave it at the default setting, but it's probably safer to use your browser's actual user-agent (the one you used to get the cookie and such.)

## FAQ

1. Is this safe? Are you going to steal my messages/account/listings?
    * Requests are done locally from your machine. The scripts are open source -- you can inspect it yourself and verify that it is private.
2. Can this script recover my old messages that were deleted?
    * If it's past April 23, then no, I'm sorry. You need to have run this script before then.
    * That said, this script will still be useful, as Carousell have said that they will be deleting one-year old messages annually (or on a rolling basis; it's not clear), so you can preserve your messages moving forward.
3. I'm not a developer and this is too hard to use!
    * Sorry about that. I'll be working on a way to make this simpler, but this depends on my free time.
4. I'm a developer and your code sucks!
    * Sorry about that. I put this together with the help of genAI a few hours before the deletion deadline.
    * I'll be improving this in my free time. But also, you are free to contribute fixes and pull requests! :)


## Todo

- [ ] currently only fetches 15 messages per thread for some reason
- [ ] figure out how to automatically get `sessionKey`
- [x] also archive photos and images
- [ ] incrementally update an existing archive instead of downloading everything all over again
- [ ] package into single executable to make it easier for non-developers
- [ ] make it easier to use chat viewer
- [ ] test across different countries / regions
