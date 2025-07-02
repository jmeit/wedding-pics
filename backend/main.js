import crypto from 'crypto'
import express from 'express'
import expressFileUpload from 'express-fileupload'
import expressCookieParser from 'cookie-parser'
import expressBodyParser from 'body-parser'
import { Upload } from "@aws-sdk/lib-storage"
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3"
import sharp from 'sharp'

const FRONTEND_DIR = `${process.cwd()}/frontend`
const port = process.env.DEVELOPMENT ? 3000 : 443

const s3client = new S3Client({
  region: 'tor1', // can be anything if not required by provider
  endpoint: process.env.S3_ENDPOINT, // <-- your custom endpoint
  forcePathStyle: true, // often required for compatibility (e.g. MinIO, Ceph)
  credentials: {
    accessKeyId: process.env.S3_SECRET_ID,
    secretAccessKey: process.env.S3_SECRET
  }
})

const app = express()
app.use(expressBodyParser.json())

app.use(expressFileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }
}));
app.use(expressCookieParser())

// Serve files
app.get('/css/:cssfile.css', (req, res) => {
  const cssfile = req.params.cssfile
  if (cssfile.match(/[^a-z]/)) { res.sendStatus(404) }
  res.sendFile(`${FRONTEND_DIR}/css/${cssfile}.css`, {}, (err) => {
    if (err) {
      res.sendStatus(404)
    }
  })
})

app.get('/js/:jsfile.js', (req, res) => {
  const jsfile = req.params.jsfile
  if (jsfile.match(/[^a-z]/)) { res.sendStatus(404) }
  res.sendFile(`${FRONTEND_DIR}/js/${jsfile}.js`, {}, (err) => {
    if (err) {
      res.sendStatus(404)
    }
  })
})

app.get('/img/:imgfile.svg', (req, res) => {
  const imgfile = req.params.imgfile
  if (imgfile.match(/[^a-z-]/)) { res.sendStatus(404) }
  res.sendFile(`${FRONTEND_DIR}/img/${imgfile}.svg`, {}, (err) => {
    if (err) {
      res.sendStatus(404)
    }
  })
})

app.get('/favicon.ico', (req, res) => {
  res.sendFile(`${FRONTEND_DIR}/img/favicon/favicon.ico`)
})

app.get('/', async (req, res) => {
  if (!req.cookies || !req.cookies.sessionId) {
    await setCookies(res)
  }
  res.sendFile(`${FRONTEND_DIR}/home.html`)
})

// API
app.post('/image', async (req, res) => {

  if (!req.files || !req.files.image) {
    return res.status(400).send({success:false,msg:"No file"})
  }

  const image = req.files.image
  const ext = image.mimetype.match(/^image\/(jpe?g|png|gif|heic|webp)$/)

  if (!ext) {
    return res.status(400).send('Invalid file type')
  }
  image.ext = ext[1]

  if (!req.cookies || !req.cookies.sessionId) {
    return res.sendStatus(400)
  }
  if ( !validateSessionID(req.cookies.sessionId) ) {
    return res.sendStatus(401)
  }
  
  const sessionId = req.cookies.sessionId

  // Compress image
  const compressedExt = 'webp'
  let imgCompresed = new Uint8Array()
  try{
  imgCompresed = await sharp(image.data)
    .autoOrient()
    .resize({
      width: 1920,
      fit: sharp.fit.inside,
      withoutEnlargement: true
    })
    .webp({ quality: 80 })
    .toBuffer()
  } catch(err) {
    console.error(err)
    return res.statusCode(500).send("Could not complete upload")
  }

  // Create thumbnail
  let thumbnail = new Uint8Array()
  try{
  thumbnail = await sharp(image.data)
    .autoOrient()
    .resize({
      width: 400,
      height: 400,
      fit: sharp.fit.cover
    })
    .webp({ quality: 50 })
    .toBuffer()
  } catch(err) {
    console.error(err)
    return res.statusCode(500).send("Could not create thumbnail")
  }

  // Upload original quality
  // No need to wait for completion to respond to user
  new Upload({
    client: s3client,
    params: {
      Key: `uploads/${sessionId}/full-${image.md5}.${image.ext}`,
      Body: image.data,
      Bucket: process.env.S3_BUCKET,
      ContentType: image.mimetype,
      ACL: 'public-read'
    }
  }).done()
  //Upload compressed version
  const compressedUpload = new Upload({
    client: s3client,
    params: {
      Key: `uploads/${sessionId}/${image.md5}.${compressedExt}`,
      Body: imgCompresed,
      Bucket: process.env.S3_BUCKET,
      ContentType: `image/${compressedExt}`,
      ACL: 'public-read'
    }
  }).done()
  // Upload thumbnail
  const thumbUpload = new Upload({
    client: s3client,
    params: {
      Key: `uploads/${sessionId}/thumb-${image.md5}.${compressedExt}`,
      Body: thumbnail,
      Bucket: process.env.S3_BUCKET,
      ContentType: `image/${compressedExt}`,
      ACL: 'public-read',
    }
  }).done()

  Promise.all([compressedUpload, thumbUpload])
    .then((s3res) => {
      res.json({
        origUri: s3res[0].Key,
        thumbUri: s3res[1].Key
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
  if ( !validateSessionID(req.cookies.sessionId) ) {
    return res.sendStatus(401)
  }
  const sessionId = req.cookies.sessionId
  const imageDelete = new DeleteObjectsCommand({
    Bucket: process.env.S3_BUCKET,
    Delete: {
      Objects: [
        { Key: `uploads/${sessionId}/${image}` },
        { Key: `uploads/${sessionId}/thumb-${image}` },
        { Key: `uploads/${sessionId}/full-${image}` },
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
  const is_gallery = !!req.header("Authorization") && req.header("Authorization") === process.env.ADMIN_PASSWORD
  const sessionId = req.cookies && req.cookies.sessionId ? req.cookies.sessionId : false

  if (
    ( !is_gallery && !sessionId )
    || ( sessionId && !validateSessionID(req.cookies.sessionId) )
  ) {
    return res.sendStatus(401)
  }

  let last_fetch = 0
  if( req.query && req.query.last_fetch && /^\d{13}$/.test(req.query.last_fetch) ) {
    last_fetch = parseInt(req.query.last_fetch, 10)
  }

  const fetch_date = sessionId ? 0 : new Date(last_fetch)
  s3client.send(new ListObjectsV2Command({
    Bucket: process.env.S3_BUCKET,
    //Prefix: `uploads/${eventId}/webp/${sessionId}/`
    Prefix: `uploads/`
  }))
    .then(list => {
      const filtered = list.Contents.filter(v =>
        v.Key.startsWith('uploads/')
        && !/\/(thumb|full)-/.test(v.Key)
        && (is_gallery || (sessionId && v.Key.includes(sessionId)))
        && new Date(v.LastModified) > fetch_date
      )
      res.setHeader('Cache-Control', 'no-cache')
      res.send(filtered)
    })
})

app.get('/config', (req, res) => {
  res.send({bucket_url: process.env.S3_BUCKET_URL})
})

app.use(function (req, res, next) {
  res.sendStatus(404)
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`)
})

async function setCookies(res) {
  const buffer = await crypto.randomBytes( parseInt( process.env.SESSION_KEY_LENGTH, 10 ) )
  const sessionId = buffer.toString('hex')

  res.cookie(
    'sessionId',
    sessionId,
    {
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      expires: new Date( Date.now() + ( 86400000 * parseInt(process.env.SESSION_EXPIRY_DAYS, 10) ) )
    })

  return sessionId
}

function validateSessionID( sessionId ) {
  const sessionIdLength = parseInt( process.env.SESSION_KEY_LENGTH, 10 ) * 2
  const sessionRegex = new RegExp(`^[a-f0-9]{${sessionIdLength}}$`)
  return sessionRegex.test(sessionId)
}