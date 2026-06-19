// MySQL 连接池与建表
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'genealogy',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

// 测试连接并自动建表
const initDb = async () => {
  const connection = await pool.getConnection();
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS genealogies (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_updated (updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS members (
        id VARCHAR(64) NOT NULL,
        genealogy_id INT UNSIGNED NOT NULL,
        name VARCHAR(255),
        gender ENUM('male','female') DEFAULT NULL,
        generation INT DEFAULT 1,
        birth VARCHAR(64),
        death VARCHAR(64),
        note TEXT,
        x DOUBLE,
        y DOUBLE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id, genealogy_id),
        INDEX idx_genealogy_member (genealogy_id),
        CONSTRAINT fk_members_genealogy
          FOREIGN KEY (genealogy_id) REFERENCES genealogies(id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS relationships (
        id VARCHAR(64) NOT NULL,
        genealogy_id INT UNSIGNED NOT NULL,
        source_id VARCHAR(64) NOT NULL,
        target_id VARCHAR(64) NOT NULL,
        relation VARCHAR(64) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id, genealogy_id),
        INDEX idx_genealogy_rel (genealogy_id),
        CONSTRAINT fk_relationships_genealogy
          FOREIGN KEY (genealogy_id) REFERENCES genealogies(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_relationships_source
          FOREIGN KEY (source_id, genealogy_id) REFERENCES members(id, genealogy_id)
          ON DELETE CASCADE,
        CONSTRAINT fk_relationships_target
          FOREIGN KEY (target_id, genealogy_id) REFERENCES members(id, genealogy_id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('[DB] MySQL 表初始化完成');
  } catch (err) {
    console.error('[DB] 初始化失败:', err.message);
    throw err;
  } finally {
    connection.release();
  }
};

module.exports = { pool, initDb };
