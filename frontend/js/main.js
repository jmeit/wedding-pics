(function () {

    const modalImgEl = document.getElementById('modal-img')
    modalImgEl.addEventListener('click', toggleModalImg)

    const imgInps = document.querySelectorAll("input[type=file]")
    imgInps.forEach(inpEl =>
        inpEl.onchange = evt => {
            const [file] = inpEl.files
            if (!file) {
                console.error("no file")
                return false;
            }

            const xhr = new XMLHttpRequest()
            xhr.open("POST", "/upload", true)
            xhr.onreadystatechange = () => {
                if (xhr.readyState === XMLHttpRequest.DONE) {
                    const status = xhr.status;
                    // In local files, status is 0 upon success in Mozilla Firefox
                    if (status === 0 || (status >= 200 && status < 400)) {
                        // The request has been completed successfully
                        loadThumb(JSON.parse(xhr.responseText))
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

    document.addEventListener('click', (evt) => {
        const target = evt.target.closest('#thumbs li')
        if (target) {
            toggleModalImg(target.getAttribute('data-origuri'))
        }
    })

})();

function loadThumb(imgUris) {
    const thumbsEl = document.getElementById("thumbs")
    const thumbEl = document.createElement("li")
    thumbEl.classList.add('thumb')
    thumbEl.style.backgroundImage = `url('${imgUris.thumbUri}')`
    thumbEl.setAttribute('data-origuri', imgUris.origUri)
    thumbsEl.appendChild(thumbEl)
}
function pullThumbs(thumbsList) {
    console.log(thumbsList)
}
function toggleModalImg(origUri) {
    const modalImgEl = document.getElementById('modal-img')
    const pageEl = document.getElementById('page')
    if ( typeof origUri == "object" ) {
        modalImgEl.classList.add('hidden')
        pageEl.classList.remove('blur')
        return
    }
    modalImgEl.style.backgroundImage = `url('${origUri}')`
    modalImgEl.classList.remove('hidden')
    pageEl.classList.add('blur')
}