const express = require("express");
const app = express();
require("dotenv").config();
const port = process.env.PORT;
const url = process.env.URL;
const frontendUrl = process.env.FRONTEND_URL;
const bodyParser = require("body-parser");
const db = require("../connection");
const response = require("../response");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const SECRET_KEY = "dasjhkda432dasdasw";
const multer = require("multer");
const path = require("path");

// Konfigurasi multer untuk menyimpan gambar
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads");
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

app.use(cors());
app.use(
  cors({
    origin: frontendUrl,
  })
);
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

console.log("PORT:", process.env.PORT);
console.log("URL:", process.env.URL);
console.log("FRONTEND_URL:", process.env.FRONTEND_URL);

// Login endpoint
app.post("/login", async (req, res) => {
  console.log("Request body:", req.body);
  const { username, password } = req.body;

  try {
    const response = await axios.get(`${url}/users`);
    const users = response.data[0]?.payload || [];

    const user = users.find((u) => u.username === username && u.password === password);
    if (user) {
      const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: "1h" });
      res
        .status(200)
        .json({ token, message: "Login successful", user: { id: user.id, username: user.username, role: user.role } });
    } else {
      res.status(401).json({ message: "Invalid username or password" });
    }
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/", (req, res) => {
  response(200, "API v1 ready connect to inventory-kharis", "SUCCESS", res);
});

app.get("/stok_barang", (req, res) => {
  const sql = "SELECT * FROM stok_barang";
  db.query(sql, (err, fields) => {
    if (err) throw err;
    response(200, fields, "all data stok_barang", res);
  });
});

app.get("/stok_barang/:id_barang", (req, res) => {
  const id_barang = req.params.id_barang;
  const sql = `SELECT * FROM stok_barang WHERE id_barang = '${id_barang}'`;
  db.query(sql, (err, fields) => {
    if (err) throw err;
    response(200, fields, "get detail barang", res);
  });
});

app.post("/stok_barang", upload.single("gambarBarang"), (req, res) => {
  const { namaBarang, jumlahBarang, hargaBarang, jenisBarang, kadaluarsaBarang, deskripsiBarang } = req.body;

  // Gambar Barang dapat diakses melalui req.file
  const gambarBarang = req.file ? req.file.filename : null;

  if (!namaBarang || !hargaBarang || !jenisBarang || !kadaluarsaBarang) {
    return response(400, null, "Missing required fields", res);
  }

  // Generate UUID for idBarang
  const idBarang = uuidv4().slice(0, 8);

  const sql = `INSERT INTO stok_barang (id_barang, nama_barang, jumlah_barang, updated_at, harga_barang, jenis_barang, gambar_barang, kadaluarsa_barang, deskripsi_barang, created_at) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, NOW())`;

  const kadaluarsaBarangDate = kadaluarsaBarang.split("T")[0];

  const values = [
    idBarang,
    namaBarang,
    jumlahBarang || null,
    hargaBarang,
    jenisBarang,
    gambarBarang,
    kadaluarsaBarangDate,
    deskripsiBarang || null,
  ];

  db.query(sql, values, (err, fields) => {
    if (err) {
      console.error("Database query error:", err);
      return response(500, null, "Database error", res);
    }
    if (fields.affectedRows) {
      response(200, { idBarang }, "Data Added Successfully", res);
    } else {
      response(500, null, "Failed to insert data", res);
    }
  });
});

app.put("/stok_barang/:id_barang", upload.single("gambarBarang"), (req, res) => {
  const { id_barang } = req.params;
  const { namaBarang, jumlahBarang, hargaBarang, jenisBarang, kadaluarsaBarang, deskripsiBarang } = req.body;

  // Gambar Barang dapat diakses melalui req.file
  const gambarBarang = req.file ? req.file.filename : null;

  if (!namaBarang || !hargaBarang || !jenisBarang || !kadaluarsaBarang) {
    return response(400, null, "Missing required fields", res);
  }

  const kadaluarsaBarangDate = kadaluarsaBarang.split("T")[0];

  const sql = `
    UPDATE stok_barang 
    SET 
      nama_barang = ?, 
      jumlah_barang = ?, 
      harga_barang = ?, 
      jenis_barang = ?, 
      gambar_barang = COALESCE(?, gambar_barang), 
      kadaluarsa_barang = ?, 
      deskripsi_barang = ?, 
      updated_at = NOW() 
    WHERE id_barang = ?
  `;

  const values = [
    namaBarang,
    jumlahBarang || 0,
    hargaBarang,
    jenisBarang,
    gambarBarang,
    kadaluarsaBarangDate,
    deskripsiBarang || null,
    id_barang,
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error("Database query error:", err);
      return response(500, null, "Database error", res);
    }

    if (result.affectedRows) {
      response(200, { idBarang: id_barang }, "Data Updated Successfully", res);
    } else {
      response(404, null, "Data not found or no changes made", res);
    }
  });
});

app.delete("/stok_barang/:id_barang", (req, res) => {
  const { id_barang } = req.params;

  const sql = `DELETE FROM stok_barang WHERE id_barang = ?`;

  console.log("Deleting item with id_barang:", id_barang); // Tambahkan log ini
  db.query(sql, [id_barang], (err, fields) => {
    if (err) {
      console.error("Database query error:", err);
      return response(500, "invalid", "error", res);
    }
    if (fields?.affectedRows) {
      const data = {
        isSuccessDelete: fields.affectedRows,
      };
      response(200, data, "Data Deleted Successfully", res);
    } else {
      response(500, "invalid", "No rows affected", res);
    }
  });
});

//endpoint kartu_stok

app.get("/kartu_stok", (req, res) => {
  const sql = "SELECT * FROM kartu_stok";
  db.query(sql, (err, fields) => {
    if (err) throw err;
    response(200, fields, "all data kartu_stok", res);
  });
});

app.get("/kartu_stok/:id_transaksi", (req, res) => {
  const id_transaksi = req.params.id_transaksi;
  const sql = `SELECT * FROM kartu_stok WHERE id_transaksi = '${id_transaksi}'`;
  db.query(sql, (err, fields) => {
    if (err) throw err;
    response(200, fields, "get detail kartu stok", res);
  });
});

app.post("/kartu_stok", (req, res) => {
  const { idBarang, jenisTransaksi, kuantitas, tanggal, deskripsi_transaksi } = req.body;

  if (!idBarang || !jenisTransaksi || !kuantitas || !tanggal || !deskripsi_transaksi) {
    return response(400, null, "Missing required fields", res);
  }

  // Query untuk mendapatkan data dari stok_barang
  const getStokBarangQuery = `
    SELECT id_barang, nama_barang, kadaluarsa_barang, jumlah_barang
    FROM stok_barang
    WHERE id_barang = ?
  `;

  db.query(getStokBarangQuery, [idBarang], (err, results) => {
    if (err) {
      console.error("Error fetching stok_barang:", err);
      return response(500, null, "Error fetching stok_barang data", res);
    }

    if (results.length === 0) {
      return response(404, null, "Barang not found", res);
    }

    const stokBarang = results[0];
    let stokAkhir;

    // Menghitung stok_akhir berdasarkan jenis_transaksi
    if (jenisTransaksi.toLowerCase() === "masuk") {
      stokAkhir = stokBarang.jumlah_barang + kuantitas;
    } else if (jenisTransaksi.toLowerCase() === "keluar") {
      stokAkhir = stokBarang.jumlah_barang - kuantitas;

      // Cek jika stok_akhir negatif
      if (stokAkhir < 0) {
        return response(400, null, "Stok akhir tidak boleh negatif", res);
      }
    } else {
      return response(400, null, "Jenis transaksi tidak valid", res);
    }

    // Generate UUID untuk id_transaksi
    const id_transaksi = uuidv4().slice(0, 10);
    console.log("received data:", req.body);

    // Query untuk insert ke kartu_stok
    const insertKartuStokQuery = `
      INSERT INTO kartu_stok (
        id_transaksi, tanggal, id_barang, nama_barang, jenis_transaksi, kadaluarsa_barang, kuantitas, stok_awal, stok_akhir, deskripsi_transaksi, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,?, NOW())
    `;

    const values = [
      id_transaksi,
      tanggal,
      stokBarang.id_barang,
      stokBarang.nama_barang,
      jenisTransaksi,
      stokBarang.kadaluarsa_barang,
      kuantitas,
      stokBarang.jumlah_barang,
      stokAkhir,
      deskripsi_transaksi,
    ];

    // Mulai transaksi database
    db.beginTransaction((err) => {
      if (err) {
        console.error("Error starting transaction:", err);
        return response(500, null, "Transaction error", res);
      }

      db.query(insertKartuStokQuery, values, (err, result) => {
        if (err) {
          console.error("Error inserting into kartu_stok:", err);
          return db.rollback(() => {
            response(500, null, "Error inserting kartu_stok", res);
          });
        }

        if (result.affectedRows) {
          // Query untuk update stok_barang
          const updateStokBarangQuery = `
            UPDATE stok_barang
            SET jumlah_barang = ?
            WHERE id_barang = ?
          `;

          db.query(updateStokBarangQuery, [stokAkhir, stokBarang.id_barang], (err, result) => {
            if (err) {
              console.error("Error updating stok_barang:", err);
              return db.rollback(() => {
                response(500, null, "Error updating stok_barang", res);
              });
            }

            // Commit transaksi
            db.commit((err) => {
              if (err) {
                console.error("Error committing transaction:", err);
                return db.rollback(() => {
                  response(500, null, "Transaction commit error", res);
                });
              }

              const data = {
                id_transaksi,
                updatedRows: result.affectedRows,
              };
              response(200, data, "New Kartu Stok Posted and Stok Barang Updated Successfully", res);
            });
          });
        } else {
          db.rollback(() => {
            response(500, null, "No rows affected", res);
          });
        }
      });
    });
  });
});

app.delete("/kartu_stok/:id_transaksi", (req, res) => {
  const { id_transaksi } = req.params;

  // Validasi input
  if (!id_transaksi) {
    return response(400, null, "Missing required id_transaksi", res);
  }

  // Query untuk mendapatkan id_barang dari kartu_stok yang akan dihapus
  const getKartuStokQuery = `
    SELECT id_barang 
    FROM kartu_stok 
    WHERE id_transaksi = ?
  `;

  db.query(getKartuStokQuery, [id_transaksi], (err, result) => {
    if (err) {
      console.error("Error fetching kartu_stok:", err);
      return response(500, null, "Error fetching kartu_stok data", res);
    }

    if (result.length === 0) {
      return response(404, null, "Kartu Stok not found", res);
    }

    const id_barang = result[0].id_barang;

    // Mulai transaksi
    db.beginTransaction((err) => {
      if (err) {
        console.error("Error starting transaction:", err);
        return response(500, null, "Transaction error", res);
      }

      // Query untuk menghapus kartu_stok berdasarkan id_kartu_stok
      const deleteKartuStokQuery = `
        DELETE FROM kartu_stok 
        WHERE id_transaksi = ?
      `;

      db.query(deleteKartuStokQuery, [id_transaksi], (err, result) => {
        if (err) {
          console.error("Error deleting kartu_stok:", err);
          return db.rollback(() => {
            response(500, null, "Error deleting kartu_stok", res);
          });
        }

        if (result.affectedRows === 0) {
          return db.rollback(() => {
            response(404, null, "No kartu_stok deleted", res);
          });
        }

        // Query untuk mendapatkan stok_akhir terbaru dari kartu_stok berdasarkan id_barang
        const getLatestStokQuery = `
          SELECT stok_akhir 
          FROM kartu_stok 
          WHERE id_barang = ?
          ORDER BY created_at DESC 
          LIMIT 1
        `;

        db.query(getLatestStokQuery, [id_barang], (err, result) => {
          if (err) {
            console.error("Error fetching latest stok_akhir:", err);
            return db.rollback(() => {
              response(500, null, "Error fetching latest stok_akhir", res);
            });
          }

          const stok_akhir = result.length > 0 ? result[0].stok_akhir : 0;

          // Query untuk mengupdate stok_barang berdasarkan stok_akhir terbaru
          const updateStokBarangQuery = `
            UPDATE stok_barang 
            SET jumlah_barang = ? 
            WHERE id_barang = ?
          `;

          db.query(updateStokBarangQuery, [stok_akhir, id_barang], (err, result) => {
            if (err) {
              console.error("Error updating stok_barang:", err);
              return db.rollback(() => {
                response(500, null, "Error updating stok_barang", res);
              });
            }

            // Commit transaksi
            db.commit((err) => {
              if (err) {
                console.error("Error committing transaction:", err);
                return db.rollback(() => {
                  response(500, null, "Transaction commit error", res);
                });
              }

              const data = {
                id_transaksi,
                updatedStokBarang: stok_akhir,
              };
              response(200, data, "transaksi deleted and Stok Barang updated successfully", res);
            });
          });
        });
      });
    });
  });
});

// endpoint /stok_opname
app.get("/stok_opname", (req, res) => {
  const sql = "SELECT * FROM stok_opname";
  db.query(sql, (err, fields) => {
    if (err) throw err;
    response(200, fields, "all data stok_opname", res);
  });
});

app.get("/stok_opname/:id_stok_opname", (req, res) => {
  const id_stok_opname = req.params.id_stok_opname;
  const sql = `SELECT * FROM stok_opname WHERE id_stok_opname = '${id_stok_opname}'`;
  db.query(sql, (err, fields) => {
    if (err) throw err;
    response(200, fields, "get detail stok opname", res);
  });
});

app.post("/stok_opname", (req, res) => {
  const { id_barang, stok_fisik, tanggal, keterangan } = req.body;

  // Pastikan id_barang, stok_fisik, dan tanggal ada dalam request body
  if (!id_barang || !stok_fisik || !tanggal || !keterangan) {
    return response(400, "invalid", "Missing required fields", res);
  }

  // Ambil data barang dari tabel stok_barang berdasarkan id_barang
  const selectQuery = `SELECT * FROM stok_barang WHERE id_barang = ?`;

  db.query(selectQuery, [id_barang], (err, result) => {
    if (err) {
      console.error("Error retrieving from stok_barang:", err);
      return response(500, "invalid", "Error retrieving data from stok_barang", res);
    }

    if (result.length === 0) {
      return response(404, "invalid", "id_barang not found", res); // Barang tidak ditemukan
    }

    // Ambil data yang diperlukan dari stok_barang
    const { nama_barang, jumlah_barang, kadaluarsa_barang } = result[0];

    // Generate UUID untuk id_stok_opname
    const id_stok_opname = uuidv4().slice(0, 8); // Generate ID unik

    // Insert query untuk memasukkan data ke tabel stok_opname
    const insertQuery = `
      INSERT INTO stok_opname (
        id_stok_opname, id_barang, nama_barang, stok_tercatat, stok_fisik, kadaluarsa_barang, tanggal, keterangan, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?,?, NOW())
    `;

    const values = [
      id_stok_opname,
      id_barang,
      nama_barang,
      jumlah_barang, // stok_tercatat diambil dari jumlah_barang pada stok_barang
      stok_fisik,
      kadaluarsa_barang,
      tanggal,
      keterangan,
    ];

    // Eksekusi query INSERT
    db.query(insertQuery, values, (err, fields) => {
      if (err) {
        console.error("Error inserting into stok_opname:", err);
        return response(500, "invalid", "Error inserting into stok_opname", res);
      }

      if (fields.affectedRows) {
        const data = {
          isSuccessInsert: fields.affectedRows,
          id: id_stok_opname,
        };
        return response(200, data, "Data Stok Opname Added Successfully", res);
      } else {
        return response(500, "invalid", "No rows affected", res);
      }
    });
  });
});

app.put("/stok_opname/:id_stok_opname", (req, res) => {
  const { id_stok_opname } = req.params; // Mengambil id_stok_opname dari parameter URL
  const { stok_fisik, tanggal, keterangan } = req.body; // Data yang akan di-update

  // Validasi data input
  if (!stok_fisik || !tanggal || !keterangan) {
    return response(400, "invalid", "Missing required fields", res);
  }

  // Query untuk memastikan id_stok_opname ada di tabel
  const checkQuery = `SELECT * FROM stok_opname WHERE id_stok_opname = ?`;
  db.query(checkQuery, [id_stok_opname], (err, result) => {
    if (err) {
      console.error("Error checking stok_opname:", err);
      return response(500, "invalid", "Error checking stok_opname", res);
    }

    if (result.length === 0) {
      return response(404, "invalid", "id_stok_opname not found", res); // Jika tidak ditemukan
    }

    // Query untuk memperbarui data di tabel stok_opname
    const updateQuery = `
      UPDATE stok_opname 
      SET stok_fisik = ?, tanggal = ?, keterangan = ?, updated_at = NOW() 
      WHERE id_stok_opname = ?
    `;

    const values = [stok_fisik, tanggal, keterangan, id_stok_opname];

    // Eksekusi query UPDATE
    db.query(updateQuery, values, (err, fields) => {
      if (err) {
        console.error("Error updating stok_opname:", err);
        return response(500, "invalid", "Error updating stok_opname", res);
      }

      if (fields.affectedRows) {
        return response(200, { isSuccessUpdate: fields.affectedRows }, "Data Stok Opname Updated Successfully", res);
      } else {
        return response(500, "invalid", "No rows affected", res);
      }
    });
  });
});

app.delete("/stok_opname/:id_stok_opname", (req, res) => {
  const { id_stok_opname } = req.params;

  const sql = `DELETE FROM stok_opname WHERE id_stok_opname = ?`;

  console.log("Deleting item with id_stok_opname:", id_stok_opname); // Tambahkan log ini
  db.query(sql, [id_stok_opname], (err, fields) => {
    if (err) {
      console.error("Database query error:", err);
      return response(500, "invalid", "error", res);
    }
    if (fields?.affectedRows) {
      const data = {
        isSuccessDelete: fields.affectedRows,
      };
      response(200, data, "Data Deleted Successfully", res);
    } else {
      response(500, "invalid", "No rows affected", res);
    }
  });
});

// endpoint/users

app.get("/users", (req, res) => {
  const sql = "SELECT * FROM users";
  db.query(sql, (err, fields) => {
    if (err) throw err;
    response(200, fields, "all data user", res);
  });
});

app.get("/users/:id", (req, res) => {
  const id = req.params.id;
  const sql = `SELECT * FROM users WHERE id = '${id}'`;
  db.query(sql, (err, fields) => {
    if (err) throw err;
    response(200, fields, "get detail user", res);
  });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
