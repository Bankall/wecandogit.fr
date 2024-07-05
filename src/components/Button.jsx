import { useState } from "react";

const Button = ({ children, onClick, className }) => {
	const [error, setError] = useState(false);
	const [content, setContent] = useState(children);
	const [isLoading, setIsLoading] = useState(false);

	const clickWrapper = async () => {
		try {
			setError(false);
			setIsLoading(true);

			const result = await onClick();
		} catch (err) {
			setError(err);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<>
			<button className={`${className}${isLoading ? " loading" : ""}`} onClick={clickWrapper}>
				{content}
			</button>
			{error && <span>{error}</span>}
		</>
	);
};

export { Button };
