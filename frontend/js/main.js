(function () {


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

            const xhr = new XMLHttpRequest()
            xhr.open("POST", "/image", true)
            xhr.onreadystatechange = () => {
                if (xhr.readyState === XMLHttpRequest.DONE) {
                    const status = xhr.status;
                    // In local files, status is 0 upon success in Mozilla Firefox
                    if (status === 0 || (status >= 200 && status < 400)) {
                        // The request has been completed successfully
                        const imgUris = JSON.parse(xhr.responseText)
                        loadThumb(imgUris)
                        const localImgs = JSON.parse(localStorage.getItem("images"))
                        localStorage.setItem("images", JSON.stringify(localImgs.concat(imgUris)))
                    } else {
                        // Oh no! There has been an error with the request!
                        console.error(xhr)
                    }
                }
            };
            xhr.upload.addEventListener("progress", (event) => {
                if (event.lengthComputable) {
                    console.log(`${event.loaded}/${event.total}`)
                }
            })
            var formData = new FormData();
            formData.append("image", file);
            xhr.send(formData);

        })

})();

function loadThumb(imgUris) {
    const thumbsEl = document.getElementById("thumbs")
    const thumbEl = document.createElement("li")
    const thumbXEl = document.createElement("button")
    thumbXEl.innerHTML = "&#128465;&#65039;"
    thumbXEl.addEventListener('click', deleteImage)
    thumbEl.appendChild(thumbXEl)
    thumbEl.classList.add('thumb')
    thumbEl.style.backgroundImage = `url('${imgUris.thumbUri}')`
    thumbEl.setAttribute('data-origuri', imgUris.origUri)
    thumbEl.addEventListener('click', toggleModalImg.bind( thumbEl, imgUris.origUri ))
    thumbsEl.appendChild(thumbEl)
}
function pullThumbs(source) {
    if (source == "local") { pullThumbsLocal() }
    else if (source == "remote") { pullThumbsRemote() }
}
function pullThumbsLocal() {
    let localImgs = JSON.parse(localStorage.getItem("images"))
    localImgs.forEach(loadThumb)
}
function pullThumbsRemote() {
    const BUCKET_URL = `https://aleandjaredwedding2025.tor1.cdn.digitaloceanspaces.com/`
    fetch('/images')
        .then(res => {
            res
                .json()
                .then(imgsRes => {
                    if (!imgsRes.length) { return alert("Couldn't fetch images from server.") }
                    const imgUris = imgsRes.map(img => {
                        const thumbParts = img.Key.split("/")
                        thumbParts[thumbParts.length - 1] = `thumb-${thumbParts.at(-1)}`
                        const thumbKey = thumbParts.join('/')
                        return {
                            origUri: `${BUCKET_URL}${img.Key}`,
                            thumbUri: `${BUCKET_URL}${thumbKey}`
                        }
                    })
                    localStorage.setItem("images", JSON.stringify(imgUris))
                    clearThumbs()
                    imgUris.forEach(loadThumb)
                })
        })
        .catch(console.error)
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
    const thumbEl = evt.target.parentNode
    const origUri = thumbEl.getAttribute('data-origuri')
    image = origUri.split("/").pop()
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
                    if (!r.success) { return alert("Couldn't delete. Try again.") }
                    const localImgs = JSON.parse(localStorage.getItem("images"))
                    const newLocalImgs = localImgs.filter(img => img.origUri !== origUri)
                    localStorage.setItem("images", JSON.stringify(newLocalImgs))
                    thumbEl.remove()
                })
        })
        .catch(console.error)
    return false
}