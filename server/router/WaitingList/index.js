import { Router } from "express";
import { errorHandler } from "../../lib/utils.js";
import config from "config";

let backend;

const router = Router();
router.route("/ping").get(async (req, res) => {
	try {
		res.send("pong");
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

router.route("/add/:idSlot").post(async (req, res) => {
	try {
		const response = await backend.post({
			table: "waiting_list",
			body: {
				id_slot: req.params.idSlot,
				id_user: req.session.user_id
			}
		});

		await backend.notify({
			who: req.session.user_id,
			action: "waiting-list",
			what: "slot",
			id_what: req.params.idSlot
		});

		res.send({ ok: true });
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

const WaitingList = _backend => {
	backend = _backend;
	return router;
};

export { WaitingList };
