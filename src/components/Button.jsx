import { useState } from "react";

const Button = ({ children, onClick, className, disableOnClick }) => {
	const [error, setError] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [disabled, setDisabled] = useState(false);
	const [content, setContent] = useState(children);

	const clickWrapper = async () => {
		try {
			if (disabled || isLoading) {
				return;
			}

			setError(false);
			setIsLoading(true);

			const result = await onClick(setContent);

			if (typeof disableOnClick === "boolean") {
				return setDisabled(disableOnClick);
			}

			if (typeof disableOnClick === "function" && typeof result !== "undefined") {
				return setDisabled(disableOnClick(result));
			}
		} catch (err) {
			setError(err);
		} finally {
			setTimeout(() => {
				setIsLoading(false);
			}, 500);
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
