(function () {
    Array.prototype.unique = function () {
        return Array.from(new Set(this.map(obj => JSON.stringify(obj)))).map(e => JSON.parse(e));
    }
    Array.prototype.includesObj = function (obj2) {
        return !!this
            .filter(obj => JSON.stringify(obj) === JSON.stringify(obj2))
            .length
    }

    const modalImgEl = document.getElementById('modal-img')
    modalImgEl.addEventListener('click', toggleModalImg)

    const localImgs = JSON.parse(localStorage.getItem("images"))
    if (!localImgs) {
        localStorage.setItem("images", "[]")
    }
    pullThumbs('local')

    const imgInps = document.querySelectorAll("input[type=file]")
    imgInps.forEach(inpEl =>
        inpEl.onchange = evt => {
            const [file] = inpEl.files
            if (!file) {
                console.error("no file")
                return false;
            }

            const mainEl = document.querySelector('main')
            mainEl.classList.add('uploading')

            var formData = new FormData()
            formData.append('image', file)

            fetch(
                "/image",
                {
                    method: "POST",
                    body: formData
                })
                .then(res => {
                    res.json().then(imgUris => {
                        const localImgs = JSON.parse(localStorage.getItem("images"))
                        if (localImgs.includesObj(imgUris)) {
                            alert("That's a duplicate")
                            return false
                        }
                        loadThumb(imgUris)
                        mainEl.classList.remove('uploading')
                        localStorage.setItem("images", JSON.stringify(localImgs.concat(imgUris)))
                    })
                })
                .catch(console.error)

        })

})();

function loadThumb(imgUris) {
    const BUCKET_URL = `https://aleandjaredwedding2025.tor1.cdn.digitaloceanspaces.com/`
    const thumbsEl = document.getElementById("thumbs")
    const thumbEl = document.createElement("li")
    const thumbXEl = document.createElement("button")
    thumbXEl.innerHTML = "&#10005;"
    thumbXEl.addEventListener('click', deleteImage)
    thumbEl.appendChild(thumbXEl)
    thumbEl.classList.add('thumb')
    thumbEl.style.backgroundImage = `url('${BUCKET_URL}${imgUris.thumbUri}')`
    thumbEl.setAttribute('data-origuri', imgUris.origUri)
    thumbEl.addEventListener('click', toggleModalImg.bind(thumbEl, `${BUCKET_URL}${imgUris.origUri}`))
    thumbsEl.appendChild(thumbEl)
}
function pullThumbs(source) {
    if (source == "local") { pullThumbsLocal() }
    else if (source == "remote") { pullThumbsRemote() }
}
function pullThumbsLocal() {
    const localImgs = JSON.parse(localStorage.getItem("images")).unique()
    localStorage.setItem("images", JSON.stringify(localImgs))
    refreshThumbs(localImgs)
}
function pullThumbsRemote() {
    fetch('/images')
        .then(res => {
            res
                .json()
                .then(imgsRes => {
                    if (!imgsRes.length) { return alert("No images found on server.") }
                    const imgUris = imgsRes
                        .map(img => {
                            const thumbParts = img.Key.split("/")
                            thumbParts[thumbParts.length - 1] = `thumb-${thumbParts.at(-1)}`
                            const thumbKey = thumbParts.join('/')
                            return {
                                origUri: `${img.Key}`,
                                thumbUri: `${thumbKey}`
                            }
                        })
                        .unique()
                    localStorage.setItem("images", JSON.stringify(imgUris))
                    refreshThumbs(imgUris)
                })
        })
        .catch(console.error)
}
function refreshThumbs(imgUris) {
    clearThumbs()
    imgUris.forEach(loadThumb)
}
function clearThumbs() {
    document.getElementById("thumbs")
        .innerHTML = ""
}
function toggleModalImg(origUri) {
    const modalImgEl = document.getElementById('modal-img')
    const pageEl = document.getElementById('page')
    if (typeof origUri == "object") {
        modalImgEl.classList.add('hidden')
        pageEl.classList.remove('blur')
        return
    }
    modalImgEl.style.backgroundImage = `url('${origUri}')`
    modalImgEl.classList.remove('hidden')
    pageEl.classList.add('blur')
}
function deleteImage(evt) {
    evt.preventDefault()
    evt.stopPropagation()

    if( !confirm("Delete this picture?") )
    {
        return false
    }

    const thumbEl = evt.target.parentNode
    thumbEl.classList.add('deleting')
    const origUri = thumbEl.getAttribute('data-origuri')
    const image = origUri.split("/").pop()
    fetch(
        '/image',
        {
            method: 'DELETE',
            body: JSON.stringify({ image }),
            headers: {
                "Content-Type": "application/json",
            }
        }
    )
        .then(res => {
            res
                .json()
                .then(r => {
                    if (!r.success) {
                        thumbEl.classList.remove('deleting')
                        alert("Couldn't delete. Try again.")
                        return false
                    }
                    const localImgs = JSON.parse(localStorage.getItem("images"))
                    const newLocalImgs = localImgs
                        .filter(img => img.origUri !== origUri)
                        .unique()
                    localStorage.setItem("images", JSON.stringify(newLocalImgs))
                    thumbEl.remove()
                })
        })
        .catch( e => {
            thumbEl.classList.remove('deleting')
            console.error(e)
        })
    return false
}