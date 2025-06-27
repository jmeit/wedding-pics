
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
                        imgs.forEach(img => images.push( img.Key ) )
                    })
            })
            .catch(console.error)
    }
    setInterval(pollImages, 30000)
    pollImages()


    let index = 0;
    const img = document.getElementById('slideshow');

    function showNextImage() {
        if(!images.length){
            return false
        }
        img.src = `${BUCKET_URL}${images[index]}`;
        index = (index + 1) % images.length;
    }

    setInterval(showNextImage, 3000);
    showNextImage();

})();