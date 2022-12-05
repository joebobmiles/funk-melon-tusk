# Funk Melon Tusk

> Seriously, what's wrong with this guy?

> DISCLAIMER: This application was built and designed to suit my needs and, as
> such, _is not well-rounded consumer software_. I do not intend to maintain
> this project, as it was a useful tool for a one-time use and has fulfilled its
> purpose.

This is a simple tool for downloading all of your saved bookmarks. To use this,
you need Node.js, Docker, Docker Compose, and a Twitter Developer account.

To get this working:

1. Create an app in your Twitter Developer account and save the client id and
  client secret into a `.env` file that looks like this:
  ```
  TWITTER_API_CLIENT_ID = <client id>
  TWITTER_API_CLIENT_SECRET = <client secret>
  ```
2. Execute the command `docker-compose up`. This will run the server and provide
  you with a login link.
3. Click the login link, approve access for the server to start downloading your
  bookmarks.
4. Wait until the server prints "Done!" to the console.

Due to Twitter API limits, the maximum number of bookmarked tweets you'll see
in the generated archive is 800. The only way around this is to delete the
downloaded bookmarks and fetch any remaining bookmarks. This could be automated
by extending the server.

---

```
This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or
distribute this software, either in source code form or as a compiled
binary, for any purpose, commercial or non-commercial, and by any
means.

In jurisdictions that recognize copyright laws, the author or authors
of this software dedicate any and all copyright interest in the
software to the public domain. We make this dedication for the benefit
of the public at large and to the detriment of our heirs and
successors. We intend this dedication to be an overt act of
relinquishment in perpetuity of all present and future rights to this
software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

For more information, please refer to <http://unlicense.org/>
```