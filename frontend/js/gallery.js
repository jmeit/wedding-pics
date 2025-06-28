
(function () {

    const BUCKET_URL = `https://aleandjaredwedding2025.tor1.cdn.digitaloceanspaces.com/`
    const password = prompt("Password:")
    const images = []

    function pollImages() {
        fetch(
            '/images',
            {
                headers: {
                    Authorization: password
                }
            }
        )
            .then(res => {
                res
                    .json()
                    .then(imgs => {
                        imgs.forEach(img => images.push(img.Key))
                    })
            })
            .catch(console.error)
    }
    setInterval(pollImages, 30000)
    pollImages()


    let index = 0;
    const imgWrap = document.getElementById('slideshow');
    imgWrap.querySelectorAll('img').forEach(imgEl => {
        imgEl.onload = showNextImage
    })

    function loadNextImage() {
        if (!images.length) {
            return false
        }
        const waitingImg = imgWrap.querySelector('.waiting')
        waitingImg.src = `${BUCKET_URL}${images[index]}`;
        index = (index + 1) % images.length;
        if (img.complete) {
            showNextImage()
        }
    }

    function showNextImage() {
        if (!images.length) {
            return false
        }
        imgWrap.querySelectorAll('img').forEach(imgEl => {
            imgEl.classList.toggle('visible')
            imgEl.classList.toggle('waiting')
        })
    }

    function stepSlideshow() {
        loadNextImage();
    }

    setInterval(stepSlideshow, 3000);
    stepSlideshow()

})();