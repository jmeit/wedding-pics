
(function () {

    const BUCKET_URL = `https://aleandjaredwedding2025.tor1.cdn.digitaloceanspaces.com/`
    const password = prompt("Password:")
    const event_id = (new URL(location.href)).searchParams.get('event_id')
    const imageKeys = []
    let last_fetch = 0

    function pollImages() {
        const current_time = Date.now()
        fetch(
            `/images?event_id=${event_id}&last_fetch=${last_fetch}&t=${current_time}`,
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
                        imgs.forEach(img => imageKeys.push(img.Key))
                        imageKeys = Array.from(new Set(imageKeys))
                        last_fetch = current_time
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
        if (!imageKeys.length) {
            return false
        }
        const waitingImg = imgWrap.querySelector('.waiting')
        waitingImg.src = `${BUCKET_URL}${imageKeys[index]}`;
        index = (index + 1) % imageKeys.length;
        if (img.complete) {
            showNextImage()
        }
    }

    function showNextImage() {
        if (!imageKeys.length) {
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