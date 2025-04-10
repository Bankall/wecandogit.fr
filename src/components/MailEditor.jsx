import { useRef, useState } from "react";
import TextEditor from "./TextEditor";
import axios from "axios";
import { useFetch } from "../hooks/useFetch";

const formatDate = date => {
	date = new Date(date.replace(/-/g, "/"));
	return date.toLocaleString().slice(0, 16);
};

export default function MailEditor() {
	const userCount = useFetch("/user-count");
	const slots = useFetch("/slot");
	const objectInput = useRef();

	const fillAutomaticObject = value => {
		const id = parseInt(value, 10);

		if (id.toString() === value && slots.data && slots.data.length) {
			const slot = slots.data.filter(slot => slot.id === id);
			objectInput.current.value = `Information au sujet du créneau ${slot[0].group_label} du ${formatDate(slot[0].date)}`;
		}
	};
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
				<select
					name='to'
					className='flex-grow'
					style={{ width: "auto" }}
					defaultValue={"active"}
					onChange={event => {
						fillAutomaticObject(event.target.value);
					}}>
					<option value='active'>Tout les utilisateurs actifs {userCount.data && userCount.data.active ? `${userCount.data.active} personnes` : ""}</option>
					<option value='all'>Tout les utilisateurs {userCount.data && userCount.data.full ? `${userCount.data.full} personnes` : ""}</option>
					{slots.data && slots.data.length
						? slots.data.map((slot, index) => (
								<option key={index} value={slot.id}>
									{formatDate(slot.date)} - {slot.group_label}
								</option>
						  ))
						: null}
				</select>
			</label>
			<input name='subject' type='text' placeholder='Objet..' className='margin-b-20' ref={objectInput}></input>
			<TextEditor onSend={sendMail} />
		</div>
	);
}
