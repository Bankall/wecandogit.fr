import { useEffect } from "react";
import { Navigation } from "swiper/modules";
import Swiper from "swiper";

import "swiper/css";
import "swiper/css/navigation";

export default function Photos() {
	useEffect(() => {
		new Swiper(".swiper", {
			modules: [Navigation],
			navigation: {
				nextEl: ".swiper-button-next",
				prevEl: ".swiper-button-prev"
			},
			loop: true,
			slidesPerView: "auto",
			spaceBetween: 10,
			autoplay: {
				delay: 5000
			}
		});
	}, []);

	return (
		<section className='photos'>
			<div className='swiper'>
				<div className='swiper-wrapper'>
					<div className='swiper-slide' lazy='true'>
						<img src='/assets/medias/home-photos/769540_91d25b57e8a14b9895752ab5350a66f0~mv2.webp' loading='lazy' />
					</div>
					<div className='swiper-slide' lazy='true'>
						<img src='/assets/medias/home-photos/769540_b49d55ec3b5548ad83497884b5892a54~mv2.webp' loading='lazy' />
					</div>
					<div className='swiper-slide' lazy='true'>
						<img src='/assets/medias/home-photos/769540_0dde9950023c4f11969a74a0f510a759~mv2.webp' loading='lazy' />
					</div>
					<div className='swiper-slide' lazy='true'>
						<img src='/assets/medias/home-photos/769540_064af9a234604ec8a0077259ab03ce3d~mv2.webp' loading='lazy' />
					</div>
					<div className='swiper-slide' lazy='true'>
						<img src='/assets/medias/home-photos/769540_4b9dd18f767c467b8f62b081ce0dd9d3~mv2.webp' loading='lazy' />
					</div>
					<div className='swiper-slide' lazy='true'>
						<img src='/assets/medias/home-photos/769540_28a6f2f538224c43a0550ed7aa4286c9~mv2.webp' loading='lazy' />
					</div>
					<div className='swiper-slide' lazy='true'>
						<img src='/assets/medias/home-photos/769540_5cdaa23e8aaa4da4815efd2b5166a410~mv2.webp' loading='lazy' />
					</div>
					<div className='swiper-slide' lazy='true'>
						<img src='/assets/medias/home-photos/769540_67b297fb8e644b36bf86554ec5926a43~mv2.webp' loading='lazy' />
					</div>
					<div className='swiper-slide' lazy='true'>
						<img src='/assets/medias/home-photos/769540_991760a446ea4197b15915a4dca5f079~mv2.webp' loading='lazy' />
					</div>
					<div className='swiper-slide' lazy='true'>
						<img src='/assets/medias/home-photos/769540_d722afc1489943f89cefd755450656cb~mv2.webp' loading='lazy' />
					</div>
					<div className='swiper-slide' lazy='true'>
						<img src='/assets/medias/home-photos/769540_e3c9df4e8d714cec97bb9efc3a40b54d~mv2.webp' loading='lazy' />
					</div>
					<div className='swiper-slide' lazy='true'>
						<img src='/assets/medias/home-photos/769540_f364eb3981f24852b462053a877d20dc~mv2.webp' loading='lazy' />
					</div>
				</div>

				<div className='swiper-button-prev'></div>
				<div className='swiper-button-next'></div>
			</div>
		</section>
	);
}
