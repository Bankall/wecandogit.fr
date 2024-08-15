import { useState } from "react";

const Button = ({ children, onClick, className, disableOnClick }) => {
	const [error, setError] = useState(false);
	const [content, setContent] = useState(children);
	const [isLoading, setIsLoading] = useState(false);
	const [disabled, setDisabled] = useState(false);

	const clickWrapper = async () => {
		try {
			if (disabled) return;

			setError(false);
			setIsLoading(true);

			const result = await onClick(setContent);

			if (disableOnClick) {
				setDisabled(true);
			}
		} catch (err) {
			setError(err);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<>
			<button className={`${className}${isLoading ? " loading" : ""}${disabled ? " disabled" : ""}`} onClick={clickWrapper}>
				{content}
			</button>
			{error && <span>{error}</span>}
		</>
	);
};

export { Button };
