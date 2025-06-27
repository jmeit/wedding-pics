const express = require('express')
const fileUpload = require('express-fileupload')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const { Upload } = require("@aws-sdk/lib-storage")
const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require("@aws-sdk/client-s3")
const crypto = require('crypto')
const imageThumbnail = require('image-thumbnail');

const FRONTEND_DIR = `${process.cwd()}/frontend`
const port = process.env.DEVELOPMENT ? 3000 : 443
let last_fetch = 0

const s3client = new S3Client({
  region: 'tor1', // can be anything if not required by provider
  endpoint: process.env.DOSPACES_ENDPOINT, // <-- your custom endpoint
  forcePathStyle: true, // often required for compatibility (e.g. MinIO, Ceph)
  credentials: {
    accessKeyId: process.env.DOSPACES_SECRET_ID,
    secretAccessKey: process.env.DOSPACES_SECRET
  }
})

const app = express()
app.use(bodyParser.json())

app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }
}));
app.use(cookieParser())

app.get('/css/:cssfile.css', (req, res) => {
  const cssfile = req.params.cssfile
  if (cssfile.match(/[^a-z]/)) { res.sendStatus(404) }
  res.sendFile(`${FRONTEND_DIR}/css/${cssfile}.css`)
})

app.get('/js/:jsfile.js', (req, res) => {
  const jsfile = req.params.jsfile
  if (jsfile.match(/[^a-z]/)) { res.sendStatus(404) }
  res.sendFile(`${FRONTEND_DIR}/js/${jsfile}.js`)
})

app.get('/', async (req, res) => {
  if (!req.cookies || !req.cookies.sessionId) {
    await setCookies(res)
  }
  res.sendFile(`${FRONTEND_DIR}/home.html`)
})

app.post('/image', async (req, res) => {

  if (!req.files || !req.files.image) {
    return res.sendStatus(400)
  }

  const image = req.files.image
  const ext = image.mimetype.match(/^image\/(jpe?g|png|gif|heic|webp)$/)

  if (!ext) {
    return res.status(400).send('Invalid file type')
  }
  image.ext = ext[1]

  let sessionId = "anon"
  if (!req.cookies || !req.cookies.sessionId) {
    sessionId = await setCookies(res)
  }
  else {
    sessionId = req.cookies.sessionId
  }

  let thumbnail = Buffer.from("")
  try {
    thumbnail = await imageThumbnail(image.data, { percentage: 25, fit: "cover" })
  }
  catch (e) {
    console.log("Error creating thumbnail")
    console.log(e)
    return res.statusCode(500).send("Could not create thumbnail")
  }

  const imageUpload = new Upload({
    client: s3client,
    params: {
      Key: `uploads/${sessionId}/${image.md5}.${image.ext}`,
      Body: image.data,
      Bucket: process.env.DOSPACES_BUCKET,
      ContentType: image.mimetype,
      ACL: 'public-read'
    }
  }).done()
  const thumbUpload = new Upload({
    client: s3client,
    params: {
      Key: `uploads/${sessionId}/thumb-${image.md5}.${image.ext}`,
      Body: thumbnail,
      Bucket: process.env.DOSPACES_BUCKET,
      ContentType: image.mimetype,
      ACL: 'public-read',
    }
  }).done()

  Promise.all([imageUpload, thumbUpload])
    .then((s3res) => {
      res.json({
        success: true,
        origUri: s3res[0].Location,
        thumbUri: s3res[1].Location
      });
    })
    .catch(e => {
      console.log(e);
      res.status(500).json({ success: false, message: "Couldn't upload file" })
    })


})

app.delete('/image', async (req, res) => {
  if (!req.body || !req.body.image) {
    return res.sendStatus(400)
  }
  const image = req.body.image
  if (!image.match(/^[0-9a-f]{32}\.(?:jpe?g|png|gif|heic|webp)$/)) {
    return res.sendStatus(400)
  }
  if (!req.cookies || !req.cookies.sessionId) {
    return res.sendStatus(400)
  }
  const sessionId = req.cookies.sessionId
  const imageDelete = new DeleteObjectsCommand({
    Bucket: process.env.DOSPACES_BUCKET,
    Delete: {
      Objects: [
        { Key: `uploads/${sessionId}/${image}` },
        { Key: `uploads/${sessionId}/thumb-${image}` }
      ]
    }
  })

  s3client.send(imageDelete)
    .then((s3res) => {
      res.json({
        success: true
      });
    })
    .catch(e => {
      console.log(e);
      res.status(500).json({ success: false, message: "Couldn't delete file" })
    })
})

app.get('/gallery', (req, res) => {
  res.sendFile(`${FRONTEND_DIR}/gallery.html`)
})

app.get('/images', (req, res) => {
  const is_admin = !!req.header("Authorization") && req.header("Authorization") === process.env.ADMIN_PASSWORD
  const sessionId = req.cookies && req.cookies.sessionId ? req.cookies.sessionId : false

  if (!is_admin && !sessionId) {
    return res.sendStatus(404)
  }

  //const fetch_date = (is_admin && req.query.all) || sessionId ? 0 : new Date(last_fetch)
  const fetch_date = 0
  s3client.send(new ListObjectsV2Command({
    Bucket: process.env.DOSPACES_BUCKET
  }))
    .then(list => {
      const filtered = list.Contents.filter(v =>
        v.Key.startsWith('uploads/')
        && !v.Key.includes('thumb')
        && (is_admin || (sessionId && v.Key.includes(sessionId)))
        && new Date(v.LastModified) > fetch_date
      )
      res.setHeader('Cache-Control', 'no-cache')
      res.send(filtered)
    })
  if (fetch_date) {
    last_fetch = Date.now()
  }
})

app.use(function (req, res, next) {
  res.sendStatus(404)
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`)
})

async function setCookies(res) {
  const buffer = await crypto.randomBytes(48)
  const sessionId = buffer.toString('hex')

  res.cookie(
    'sessionId',
    sessionId,
    {
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      expires: new Date(Date.now() + 86400000) // 24hrs
    })

  return sessionId
}