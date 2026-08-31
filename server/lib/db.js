import mysql from "mysql2/promise";
import config from "config";

const pool = mysql.createPool({
	host: config.get("mysql.host"),
	user: config.get("mysql.user"),
	password: config.get("mysql.password"),
	database: config.get("mysql.database"),
	waitForConnections: true,
	connectionLimit: 10,
	dateStrings: true,
	// Les colonnes DECIMAL (prix) doivent arriver en nombre, pas en chaîne
	decimalNumbers: true
});

const query = async (sql, params = [], connection = pool) => {
	const [rows] = await connection.query(sql, params);
	return rows;
};

const withTransaction = async handler => {
	const connection = await pool.getConnection();
	try {
		await connection.beginTransaction();
		const result = await handler(connection);
		await connection.commit();
		return result;
	} catch (err) {
		await connection.rollback();
		throw err;
	} finally {
		connection.release();
	}
};

export { pool, query, withTransaction };
