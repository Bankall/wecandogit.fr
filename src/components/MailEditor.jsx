import { useState } from "react";
import TextEditor from "./TextEditor";
import axios from "axios";

export default function MailEditor() {
	const sendMail = async content => {
		try {
			await axios.post(`/send-mail`, {
				content,
				to: document.querySelector("select[name=to]").value,
				subject: document.querySelector("input[name=subject]").value
			});
		} catch (err) {
			throw err;
		}
	};

	return (
		<div className='text-editor'>
			<label className='flex-row margin-b-20'>
				Envoyer le mail à
				<select name='to' className='flex-grow' style={{ width: "auto" }}>
					<option value='all'>Tout le monde</option>
				</select>
			</label>
			<input name='subject' type='text' placeholder='Objet..' className='margin-b-20'></input>
			<TextEditor onSend={sendMail} />
		</div>
	);
}
