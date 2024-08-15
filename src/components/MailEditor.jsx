import { useState } from "react";
import TextEditor from "./TextEditor";
import axios from "axios";
import { useFetch } from "../hooks/useFetch";

export default function MailEditor() {
	const userCount = useFetch("/user-count");

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
					<option value='all'>Tout le monde {userCount.data && userCount.data.full ? `${userCount.data.full} personnes` : ""}</option>
					<option value='active'>Tout les utilisateurs actifs {userCount.data && userCount.data.active ? `${userCount.data.active} personnes` : ""}</option>
				</select>
			</label>
			<input name='subject' type='text' placeholder='Objet..' className='margin-b-20'></input>
			<TextEditor onSend={sendMail} />
		</div>
	);
}
