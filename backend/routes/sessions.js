// 族谱会话 CRUD（MySQL 持久化）
const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// 列表
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, created_at, updated_at FROM genealogies ORDER BY updated_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Sessions] 列表失败:', err);
    res.status(500).json({ success: false, error: { code: 'LIST_FAILED', message: err.message } });
  }
});

// 创建会话
router.post('/', async (req, res) => {
  const { name = '未命名族谱' } = req.body || {};
  try {
    const [result] = await pool.query(
      'INSERT INTO genealogies (name) VALUES (?)',
      [String(name).trim() || '未命名族谱']
    );
    res.status(201).json({ success: true, data: { id: result.insertId, name } });
  } catch (err) {
    console.error('[Sessions] 创建失败:', err);
    res.status(500).json({ success: false, error: { code: 'CREATE_FAILED', message: err.message } });
  }
});

// 加载会话
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [[session]] = await pool.query(
      'SELECT id, name, created_at, updated_at FROM genealogies WHERE id = ?',
      [id]
    );
    if (!session) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '会话不存在' } });
    }
    const [members] = await pool.query(
      'SELECT id, name, gender, generation, birth, death, note, avatar, x, y FROM members WHERE genealogy_id = ?',
      [id]
    );
    const [relationships] = await pool.query(
      'SELECT id, source_id, target_id, relation FROM relationships WHERE genealogy_id = ?',
      [id]
    );
    res.json({
      success: true,
      data: {
        ...session,
        members,
        relationships
      }
    });
  } catch (err) {
    console.error('[Sessions] 加载失败:', err);
    res.status(500).json({ success: false, error: { code: 'LOAD_FAILED', message: err.message } });
  }
});

// 保存/覆盖会话
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, members = [], relationships = [] } = req.body || {};

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 确认会话存在
    const [[session]] = await connection.query(
      'SELECT id FROM genealogies WHERE id = ? FOR UPDATE',
      [id]
    );
    if (!session) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '会话不存在' } });
    }

    // 更新会话名
    if (name !== undefined) {
      await connection.query('UPDATE genealogies SET name = ? WHERE id = ?', [String(name).trim() || '未命名族谱', id]);
    }

    // 全量替换成员与关系
    await connection.query('DELETE FROM relationships WHERE genealogy_id = ?', [id]);
    await connection.query('DELETE FROM members WHERE genealogy_id = ?', [id]);

    if (members.length > 0) {
      const memberSql = `
        INSERT INTO members
          (id, genealogy_id, name, gender, generation, birth, death, note, avatar, x, y)
        VALUES ?
      `;
      const memberValues = members.map(m => [
        m.id,
        id,
        m.name || null,
        m.gender || null,
        m.generation || 1,
        m.birth || null,
        m.death || null,
        m.note || null,
        m.avatar || null,
        m.x != null ? m.x : null,
        m.y != null ? m.y : null
      ]);
      await connection.query(memberSql, [memberValues]);
    }

    if (relationships.length > 0) {
      const relSql = `
        INSERT INTO relationships
          (id, genealogy_id, source_id, target_id, relation)
        VALUES ?
      `;
      const relValues = relationships.map(r => [
        r.id,
        id,
        r.source_id || r.source || null,
        r.target_id || r.target || null,
        r.relation
      ]).filter(r => r[2] && r[3] && r[4]);
      if (relValues.length > 0) {
        await connection.query(relSql, [relValues]);
      }
    }

    await connection.commit();
    res.json({ success: true, data: { id } });
  } catch (err) {
    await connection.rollback();
    console.error('[Sessions] 保存失败:', err);
    res.status(500).json({ success: false, error: { code: 'SAVE_FAILED', message: err.message } });
  } finally {
    connection.release();
  }
});

// 删除会话
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query('DELETE FROM genealogies WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '会话不存在' } });
    }
    res.json({ success: true, data: { id } });
  } catch (err) {
    console.error('[Sessions] 删除失败:', err);
    res.status(500).json({ success: false, error: { code: 'DELETE_FAILED', message: err.message } });
  }
});

module.exports = router;
