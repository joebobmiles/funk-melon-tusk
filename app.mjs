import { Client, auth } from "twitter-api-sdk";
import express from "express";
import fetch from "node-fetch";
import { Buffer } from "node:buffer";
import { writeFile, mkdir } from "node:fs/promises";
import { execSync } from "node:child_process";
import { v4 as uuid } from "uuid";
import { stringify } from "yaml";

const app = express();

const authClient = new auth.OAuth2User({
  client_id: process.env.TWITTER_API_CLIENT_ID,
  client_secret: process.env.TWITTER_API_CLIENT_SECRET,
  callback: "http://127.0.0.1:3000/callback",
  scopes: ["tweet.read", "bookmark.read", "users.read"],
});

const client = new Client(authClient);

const STATE = "my-state";

app.get("/callback", async function (req, res) {
  try {
    const { code, state } = req.query;
    if (state !== STATE) return res.status(500).send("State isn't matching");
    await authClient.requestAccessToken(code);
    res.redirect("/bookmarks");
  } catch (error) {
    console.log(error);
  }
});

app.get("/login", async function (req, res) {
  const authUrl = authClient.generateAuthURL({
    state: STATE,
    code_challenge_method: "s256",
  });
  res.redirect(authUrl);
});


const fetchBookmarks = async function* (userId) {
  let paginationToken = undefined

  while (true) {
    const bookmarks = await client.bookmarks.getUsersIdBookmarks(
      userId,
      {
        pagination_token: paginationToken,
        expansions: [ "attachments.media_keys", "author_id" ],
        "media.fields": [ "url", "variants" ],
        "user.fields": [ "name", "description", "entities" ],
        "tweet.fields": [ "entities", "created_at", "referenced_tweets" ],
      }
    );

    paginationToken = bookmarks.meta.next_token;

    if (paginationToken === undefined)
      return bookmarks;
    else
      yield bookmarks;
  }
}

const getAllBookmarks = async (id) => {
  const bookmarkQuery = fetchBookmarks(id);

  const tweets = [];
  const media = {};
  const users = {};

  while (true)
  {
    const { value: results, done, } = await bookmarkQuery.next()

    if (done) break;

    results.data.forEach(
      (tweet) => {
        tweets.push(tweet)
      }
    )

    results.includes.media.forEach(
      (item) => {
        media[item.media_key] = item
      }
    )

    results.includes.users.forEach(
      (user) => {
        users[user.id] = user
      }
    )
  }

  return [
    tweets,
    media,
    users,
  ]
}

const processBookmarkRequest = async () => {
  const { data: { id, username } } = await client.users.findMyUser();

  const [ bookmarkedTweets, media, users ] = await getAllBookmarks(id);

  let path = [ "/tmp", `${username}_${uuid()}` ];

  await mkdir(path.join('/'));

  for (const tweet of bookmarkedTweets)
  {
    let {
      id,
      author_id,
      text,
      attachments,
      entities,
      created_at,
      referenced_tweets,
    } = tweet;

    const author = users[author_id]

    path.push(id)

    await mkdir(path.join('/'));

    if (entities && entities.urls) {
      for (const { url, unwound_url } of entities.urls)
      {
        // Unlike expanded_url, unwound_url only exists for external resources.
        if (unwound_url) {
          text = text.replace(url, unwound_url)
        }
        // If there is no unwound_url, we know we found an internal resource, so
        // we'll remove the link.
        else {
          text = text.replace(url, "")
        }
      }
    }

    if (author.entities && author.entities.description && author.entities.description && author.entities.description.urls) {
      for (const { url, expanded_url } of author.entities.description.urls)
      {
        // Unlike with the tweet text, descriptions only have expanded url.
        // Lucky for us, internal resources are not found in the description, so
        // we don't need to differentiate, only safeguard.
        if (expanded_url) {
          author.description = author.description.replace(url, expanded_url)
        }
      }
    }

    await writeFile(
      `${path.join('/')}/tweet.md`,
      stringify({
        original_url: `https://twitter.com/${author.username}/status/${id}`,
        created_at,
        author: {
          name: author.name,
          url: `https://twitter.com/${author.username}`,
          description: author.description
        }
      })
      + "---\n"
      +text
    );

    if (attachments !== undefined) {
      for (let key of attachments.media_keys) {
        const item = media[key];

        if (item.url !== undefined) {
          const blob = await fetch(
            item.url,
            {
              mode: 'cors'
            }
          ).then(response => response.blob());

          const buffer = Buffer.from(await blob.arrayBuffer());
          const fileEnding = blob.type.split('/')[1];

          await writeFile(`${path.join('/')}/${item.media_key}.${fileEnding}`, buffer);
        }
        else if (item.variants !== undefined) {
          const { url } = item.variants.reduce((bestVariant, currentVariant) => {
            const { bit_rate: bestBitRate } = bestVariant;
            const { bit_rate: currentBitRate } = currentVariant;

            if (currentBitRate !== undefined && bestBitRate < currentBitRate)
              return currentVariant;
            else
              return bestVariant;
          }, { bit_rate: 0 })

          if (url !== undefined) {
            const blob = await fetch(
              url,
              {
                mode: 'cors'
              }
            ).then(response => response.blob());

            const buffer = Buffer.from(await blob.arrayBuffer());
            const fileEnding = blob.type.split('/')[1];

            await writeFile(`${path.join('/')}/${item.media_key}.${fileEnding}`, buffer);
          }
        }
      }
    }

    if (referenced_tweets) {
      for (const { type, id } of referenced_tweets) {
        switch (type) {
          case 'quoted': {
            let {
              data: {
                author_id,
              text,
              entities,
              attachments,
            },
            includes: {
              media,
              users,
            }
          } = await client.tweets.findTweetById(id, {
            expansions: [ "attachments.media_keys", "author_id" ],
            "media.fields": [ "url", "variants" ],
            "user.fields": [ "name", "description", "entities" ],
            "tweet.fields": [ "entities", "created_at", "referenced_tweets" ],
          });

          const author = users.find(({ id }) => id === author_id);

          path.push(id);

          await mkdir(path.join('/'));

          if (entities && entities.urls) {
            for (const { url, unwound_url } of entities.urls)
            {
              // Unlike expanded_url, unwound_url only exists for external resources.
              if (unwound_url) {
                text = text.replace(url, unwound_url)
              }
              // If there is no unwound_url, we know we found an internal resource, so
              // we'll remove the link.
              else {
                text = text.replace(url, "")
              }
            }
          }

          if (author.entities && author.entities.description && author.entities.description && author.entities.description.urls) {
            for (const { url, expanded_url } of author.entities.description.urls)
            {
              // Unlike with the tweet text, descriptions only have expanded url.
              // Lucky for us, internal resources are not found in the description, so
              // we don't need to differentiate, only safeguard.
              if (expanded_url) {
                author.description = author.description.replace(url, expanded_url)
              }
            }
          }

          await writeFile(
            `${path.join('/')}/tweet.md`,
            stringify({
              original_url: `https://twitter.com/${author.username}/status/${id}`,
              created_at,
              author: {
                name: author.name,
                url: `https://twitter.com/${author.username}`,
                description: author.description
              }
            })
            + "---\n"
            +text
          );

          if (attachments !== undefined) {
            for (let key of attachments.media_keys) {
              const item = media.find(({ media_key }) => media_key === key);

              if (item.url !== undefined) {
                const blob = await fetch(
                  item.url,
                  {
                    mode: 'cors'
                  }
                ).then(response => response.blob());

                const buffer = Buffer.from(await blob.arrayBuffer());
                const fileEnding = blob.type.split('/')[1];

                await writeFile(`${path.join('/')}/${item.media_key}.${fileEnding}`, buffer);
              }
              else if (item.variants !== undefined) {
                const { url } = item.variants.reduce((bestVariant, currentVariant) => {
                  const { bit_rate: bestBitRate } = bestVariant;
                  const { bit_rate: currentBitRate } = currentVariant;

                  if (currentBitRate !== undefined && bestBitRate < currentBitRate)
                    return currentVariant;
                  else
                    return bestVariant;
                }, { bit_rate: 0 })

                if (url !== undefined) {
                  const blob = await fetch(
                    url,
                    {
                      mode: 'cors'
                    }
                  ).then(response => response.blob());

                  const buffer = Buffer.from(await blob.arrayBuffer());
                  const fileEnding = blob.type.split('/')[1];

                  await writeFile(`${path.join('/')}/${item.media_key}.${fileEnding}`, buffer);
                }
              }
            }
          }

            path = path.slice(0, -1)
          } break;
          
          default:
            break;
        }
      }
    }

    path = path.slice(0, -1)
  }

  execSync(
    `zip -r ${path.join("/")}.zip ./*`,
    {
      cwd: path.join("/")
    }
  );

  console.log("Done!")
}

app.get("/bookmarks", function (req, res) {
  res.send();

  processBookmarkRequest();
});

app.get("/revoke", async function (req, res) {
  try {
    const response = await authClient.revokeAccessToken();
    res.send(response);
  } catch (error) {
    console.log(error);
  }
});

app.listen(3000, () => {
  console.log("Go here to login: http://127.0.0.1:3000/login");
});