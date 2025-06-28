
(function () {
    window.BUCKET_URL = `https://aleandjaredwedding2025.tor1.cdn.digitaloceanspaces.com/`

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
                        mainEl.classList.remove('uploading')
                        const localImgs = JSON.parse(localStorage.getItem("images"))
                        if (localImgs.includesObj(imgUris)) {
                            alert("That's a duplicate")
                            return false
                        }
                        loadThumb(imgUris)
                        localStorage.setItem("images", JSON.stringify(localImgs.concat(imgUris)))
                    })
                })
                .catch(console.error)

        })

})();

function loadThumb(imgUris) {
    const thumbsEl = document.getElementById("thumbs")
    const thumbEl = document.createElement("li")
    const thumbXEl = document.createElement("button")
    thumbXEl.innerHTML = "&#10005;"
    thumbXEl.addEventListener('click', deleteImage)
    thumbEl.appendChild(thumbXEl)
    thumbEl.classList.add('thumb')
    thumbEl.style.backgroundImage = `url('${window.BUCKET_URL}${imgUris.thumbUri}')`
    thumbEl.setAttribute('data-origuri', imgUris.origUri)
    thumbEl.addEventListener( 'click', toggleModalImg )
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
function toggleModalImg(evt) {
    const modalImgEl = document.getElementById('modal-img')
    const pageEl = document.getElementById('page')

    // Close Modal
    if ( !evt || !this.classList.contains('thumb') ) {
        modalImgEl.classList.add('hidden')
        pageEl.classList.remove('blur')
        modalImgEl.removeAttribute('data-origuri')
        return
    }

    // Open Modal
    const imgUri = this. getAttribute('data-origuri')
    const butDelete = modalImgEl.querySelector('#but-delete')
    butDelete.removeEventListener('click',deleteImage)
    butDelete.addEventListener('click',deleteImage)
    modalImgEl.setAttribute('data-origuri',imgUri)
    modalImgEl.style.backgroundImage = `url('${window.BUCKET_URL}${imgUri}')`
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

    const parentEl = evt.target.parentNode
    const origUri = parentEl.getAttribute('data-origuri')
    const thumbEl = parentEl.classList.contains('thumb') ? parentEl : document.querySelector(`.thumb[data-origuri="${origUri}"]`)
    thumbEl.classList.add('deleting')
    const image = origUri.split("/").pop()
    
    toggleModalImg(false)

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