// // VERIFICACIÓN DE SESIÓN
async function checkAuthSession() {
  try {
    const res = await fetch('login.php?action=check_session');
    const data = await res.json();
    if (!data.logged) {
      window.location.href = 'login.html';
    }
  } catch (e) {
    console.error("Error al verificar sesión", e);
  }
}

if (window.location.pathname.includes('index_3.html') || window.location.pathname.includes('index_2.html')) {
  checkAuthSession();
}

// VARIABLES GLOBALES
let students = [];
let totalSchoolDays = 1;
let lateTimeLimit = '08:00';
let html5QrcodeScanner = null;

// ==========================================
// FUNCIÓN PARA VER IMAGEN AMPLIADA EN MODAL
// ==========================================
function verImagenCompleta(urlImagen) {
  const imgElement = document.getElementById('imgAmpliada');
  if (imgElement) {
    imgElement.src = urlImagen;
  }
  const modalEl = document.getElementById('modalImagenCompleta');
  if (modalEl) {
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }
}

// ==========================================
// MÓDULO: MODO KIOSCO AUTOMÁTICO QR
// ==========================================
let kioskTimeout = null;
let countdownInterval = null;

async function processAttendance(dni) {
  const alertEl = document.getElementById('attendance-alert');
  if (!dni) return;

  try {
    const res = await fetch('api.php?action=register_attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dni })
    });

    const data = await res.json();

    if (!res.ok) {
      showAlert(alertEl, data.message, 'danger');
      return;
    }

    const audio = document.getElementById('success-audio');
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(e => console.log("Audio bloqueado por el navegador:", e));
    }

    mostrarTarjetaKiosco(data);
    loadDataFromDB();
  } catch (err) {
    showAlert(alertEl, 'Error al conectar con la base de datos.', 'danger');
  }
}

function mostrarTarjetaKiosco(data) {
  const modal = document.getElementById('kiosk-modal');
  const card = document.getElementById('kiosk-card');
  const nameEl = document.getElementById('kiosk-name');
  const gradeEl = document.getElementById('kiosk-grade');
  const statusBadge = document.getElementById('kiosk-status-badge');
  const timeEl = document.getElementById('kiosk-time');
  const photoEl = document.getElementById('kiosk-photo');
  const defaultIcon = document.getElementById('kiosk-default-icon');
  const countdownEl = document.getElementById('kiosk-countdown');

  if (!modal) return;

  nameEl.textContent = data.name || "Estudiante";
  gradeEl.textContent = `${data.grade || ""} "${data.section || ""}"`;
  timeEl.textContent = `Hora de registro: ${data.time}`;

  const isLate = data.status === 'Tarde';
  statusBadge.textContent = isLate ? '¡TARDE!' : '¡PRESENTE!';
  statusBadge.style.backgroundColor = isLate ? '#ffc107' : '#28a745';
  statusBadge.style.color = isLate ? '#000' : '#fff';
  card.style.borderColor = isLate ? '#ffc107' : '#28a745';

  if (data.foto && data.foto.trim() !== "") {
    photoEl.src = data.foto;
    photoEl.style.display = 'block';
    defaultIcon.style.display = 'none';
  } else {
    photoEl.style.display = 'none';
    defaultIcon.style.display = 'block';
  }

  modal.style.display = 'flex';

  let timeLeft = 3;
  countdownEl.textContent = timeLeft;

  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    timeLeft--;
    if (countdownEl) countdownEl.textContent = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(countdownInterval);
    }
  }, 1000);

  if (kioskTimeout) clearTimeout(kioskTimeout);
  kioskTimeout = setTimeout(() => {
    cerrarTarjetaKiosco();
  }, 3000);
}

function cerrarTarjetaKiosco() {
  const modal = document.getElementById('kiosk-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  if (kioskTimeout) clearTimeout(kioskTimeout);
  if (countdownInterval) clearInterval(countdownInterval);

  const dniInput = document.getElementById('dni-input');
  if (dniInput) {
    dniInput.focus();
  }
}

// ==========================================
// VARIABLES DEL CALENDARIO INTERACTIVO
// ==========================================
let fechaActualCal = new Date();
let fechaSeleccionadaGlobal = '';

// ==========================================
// GRÁFICO DE ASISTENCIA (Chart.js)
// ==========================================
let miGraficoAsistencia = null;

function actualizarGraficoAsistencia() {
  const ctx = document.getElementById('asistenciaChart');
  if (!ctx) return;

  const presentes = parseInt(document.getElementById('stat-presents').textContent) || 0;
  const tardanzas = parseInt(document.getElementById('stat-tardies').textContent) || 0;
  const ausentes  = parseInt(document.getElementById('stat-absents').textContent) || 0;

  const datosGrafico = {
    labels: ['Presentes', 'Tardanzas', 'Ausentes'],
    datasets: [{
      label: 'Estudiantes',
      data: [presentes, tardanzas, ausentes],
      backgroundColor: [
        'rgba(40, 167, 69, 0.7)',
        'rgba(255, 193, 7, 0.7)',
        'rgba(220, 53, 69, 0.7)'
      ],
      borderColor: [
        'rgb(40, 167, 69)',
        'rgb(255, 193, 7)',
        'rgb(220, 53, 69)'
      ],
      borderWidth: 1,
      borderRadius: 6
    }]
  };

  if (miGraficoAsistencia) {
    miGraficoAsistencia.data.datasets[0].data = [presentes, tardanzas, ausentes];
    miGraficoAsistencia.update();
  } else {
    miGraficoAsistencia = new Chart(ctx, {
      type: 'bar',
      data: datosGrafico,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 }
          }
        }
      }
    });
  }
}

// AL CARGAR LA PÁGINA
document.addEventListener('DOMContentLoaded', () => {
  loadDataFromDB();
  setupEventListeners();
  initQrScanner();
  renderCalendarioEditable();
  cargarExcepcionesCalendario(); 
  cargarProfesores(); 
  setTimeout(actualizarGraficoAsistencia, 300); 
});

// 1. CARGAR DATOS DESDE LA BASE DE DATOS
async function loadDataFromDB() {
  try {
    const res = await fetch('api.php?action=get_students');
    const data = await res.json();

    if (data.config) {
      document.getElementById('school-name-text').textContent = data.config.nombre_colegio;
      document.getElementById('cfg-school-name').value = data.config.nombre_colegio;
      
      lateTimeLimit = data.config.hora_limite;
      if (data.config.hora_limite) {
        let timeStr = data.config.hora_limite.substring(0, 5);
        let [h, m] = timeStr.split(':');
        let horaInt = parseInt(h);
        let meridiem = 'AM';

        if (horaInt >= 12) {
          meridiem = 'PM';
          if (horaInt > 12) horaInt -= 12;
        }
        if (horaInt === 0) horaInt = 12;

        let horaFormatted = String(horaInt).padStart(2, '0') + ':' + m;

        const cfgLimitTimeEl = document.getElementById('cfg-limit-time');
        if (cfgLimitTimeEl) cfgLimitTimeEl.value = horaFormatted;

        const cfgMeridiemEl = document.getElementById('cfg-meridiem');
        if (cfgMeridiemEl) cfgMeridiemEl.value = meridiem;

        const displayLimitTimeEl = document.getElementById('display-limit-time');
        if (displayLimitTimeEl) {
          displayLimitTimeEl.textContent = `${horaFormatted} ${meridiem}`;
        }
      }
      
      totalSchoolDays = parseInt(data.config.total_dias) || 1;
      document.getElementById('total-days').textContent = totalSchoolDays;
      const lblDias = document.getElementById('lbl-dias-acumulados');
      if (lblDias) lblDias.textContent = totalSchoolDays;
    }

    students = data.students || [];
    renderTable();
    updateStats();
    renderizarCarnetsCredencial();
  } catch (err) {
    console.error("Error al cargar datos desde la base de datos:", err);
  }
}

// 2. CONFIGURAR EVENT LISTENERS
function setupEventListeners() {
  document.getElementById('config-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const schoolName = document.getElementById('cfg-school-name').value.trim();
    let limitTimeInput = document.getElementById('cfg-limit-time').value;
    const meridiem = document.getElementById('cfg-meridiem')?.value || 'AM';

    if (limitTimeInput) {
      let [h, m] = limitTimeInput.split(':');
      let horaInt = parseInt(h);

      if (meridiem === 'PM' && horaInt < 12) {
        horaInt += 12;
      } else if (meridiem === 'AM' && horaInt === 12) {
        horaInt = 0;
      }
      limitTimeInput = `${String(horaInt).padStart(2, '0')}:${m}:00`;
    }

    const res = await fetch('api.php?action=save_config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolName, limitTime: limitTimeInput })
    });

    if (res.ok) {
      alert('Configuración guardada correctamente.');
      closeConfigModal();
      loadDataFromDB();
    } else {
      alert('Error al guardar la configuración.');
    }
  });

  document.getElementById('attendance-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('dni-input');
    if (input) {
      processAttendance(input.value.trim());
      input.value = '';
    }
  });

  document.getElementById('student-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dni = document.getElementById('new-dni').value.trim();
    const name = document.getElementById('new-name').value.trim();
    const grade = document.getElementById('new-grade').value;
    const section = document.getElementById('new-section').value;

    const res = await fetch('api.php?action=add_student', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dni, name, grade, section })
    });

    const data = await res.json();
    const alertEl = document.getElementById('student-alert');
    if (res.ok) {
      showAlert(alertEl, data.message || 'Estudiante guardado correctamente.', 'success');
      e.target.reset();
      loadDataFromDB();
    } else {
      showAlert(alertEl, data.message, 'danger');
    }
  });

  document.getElementById('edit-student-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const originalDni = document.getElementById('edit-original-dni').value;
    const dni = document.getElementById('edit-dni').value.trim();
    const name = document.getElementById('edit-name').value.trim();
    const grade = document.getElementById('edit-grade').value;
    const section = document.getElementById('edit-section').value;

    const res = await fetch('api.php?action=edit_student', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ originalDni, dni, name, grade, section })
    });

    const data = await res.json();
    if (res.ok) {
      closeEditModal();
      loadDataFromDB();
    } else {
      alert(data.message);
    }
  });
}

// 4. RENDERIZAR TABLA DE ESTUDIANTES EN FORMATO DE TARJETAS
function renderTable() {
  const container = document.getElementById('student-table-container') || document.getElementById('student-table-body')?.parentElement?.parentElement;
  if (!container) return;

  const filtered = students;

  const mapaGrados = {
    '1': 'PRIMERO', '1°': 'PRIMERO', '1° SEC.': 'PRIMERO', 'PRIMERO': 'PRIMERO',
    '2': 'SEGUNDO', '2°': 'SEGUNDO', '2° SEC.': 'SEGUNDO', 'SEGUNDO': 'SEGUNDO',
    '3': 'TERCERO', '3°': 'TERCERO', '3° SEC.': 'TERCERO', 'TERCERO': 'TERCERO',
    '4': 'CUARTO', '4°': 'CUARTO', '4° SEC.': 'CUARTO', 'CUARTO': 'CUARTO',
    '5': 'QUINTO', '5°': 'QUINTO', '5° SEC.': 'QUINTO', 'QUINTO': 'QUINTO',
    '6': 'SEXTO', '6°': 'SEXTO', '6° SEC.': 'SEXTO', 'SEXTO': 'SEXTO'
  };

  const studentsByClass = filtered.reduce((acc, student) => {
    let rawGrade = String(student.grade || 'Sin Grado').trim().toUpperCase();
    let numeroGrado = rawGrade.replace(/[^0-9]/g, '');
    let nombreGrado = mapaGrados[numeroGrado] || mapaGrados[rawGrade] || rawGrade;
    let seccionLimpia = String(student.section || 'Única').trim().toUpperCase();

    const key = `${nombreGrado} "${seccionLimpia}"`;

    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(student);
    return acc;
  }, {});

  if (Object.keys(studentsByClass).length === 0) {
    container.innerHTML = `<div style="text-align: center; padding: 30px; color: #666; background: #fff; border-radius: 12px; border: 1px solid #e5e7eb;">No se encontraron estudiantes.</div>`;
    return;
  }

  let html = `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; margin-bottom: 25px;">
  `;

  for (const [className, groupStudents] of Object.entries(studentsByClass)) {
    let cardBgColor = '#ffffff';
    let borderColor = '#e5e7eb';
    let accentColor = '#f59e0b';

    if (className.includes('PRIMERO') || className.includes('SEGUNDO')) {
      accentColor = '#fde047'; 
    } else {
      accentColor = '#93c5fd'; 
    }

    html += `
      <div class="folder-card-item shadow-sm" style="background-color: ${cardBgColor}; border: 1px solid ${borderColor}; border-radius: 12px; padding: 20px; transition: transform 0.2s, box-shadow 0.2s; position: relative; overflow: hidden;">
        <div style="position: absolute; top: 0; left: 0; width: 6px; height: 100%; background-color: ${accentColor};"></div>
        <div class="folder-header d-flex justify-content-between align-items-center" style="cursor: pointer; padding-left: 8px;" onclick="toggleFolderModal('${className.replace(/[\s"]/g, '_')}')">
          <div>
            <h4 class="m-0" style="font-size: 1.25rem; font-weight: 700; color: #1f2937; letter-spacing: -0.025em;">📁 ${className}</h4>
            <span style="font-size: 0.85rem; color: #6b7280; font-weight: 500; margin-top: 4px; display: inline-block;">${groupStudents.length} estudiantes</span>
          </div>
          <button class="btn btn-sm" style="background: #f3f4f6; color: #374151; font-weight: 600; border-radius: 8px; padding: 6px 12px; font-size: 0.85rem; border: none;">Ver lista →</button>
        </div>
      </div>
    `;
  }

  html += `</div>`;
  
  if (!document.getElementById('modal-burbuja-container')) {
    html += `<div id="modal-burbuja-container"></div>`;
  }

  window._studentsByClassData = studentsByClass;
  container.innerHTML = html;
}

function toggleFolderModal(classNameKey) {
  const dataMap = window._studentsByClassData;
  let targetClassName = '';
  let groupStudents = [];

  for (const [key, studentsArr] of Object.entries(dataMap)) {
    if (key.replace(/[\s"]/g, '_') === classNameKey) {
      targetClassName = key;
      groupStudents = studentsArr;
      break;
    }
  }

  window._currentModalStudents = groupStudents;
  window._currentModalClassNameKey = classNameKey;
  window._currentClassNameTitle = targetClassName; // Guardamos el nombre para el archivo descargado

  let modalContainer = document.getElementById('modal-burbuja-container');
  if (!modalContainer) {
    modalContainer = document.createElement('div');
    modalContainer.id = 'modal-burbuja-container';
    document.body.appendChild(modalContainer);
  }

  let tableHtml = `
    <div class="modal-backdrop-burbuja animate__animated animate__fadeIn" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); display: flex; justify-content: center; align-items: center; z-index: 1050; padding: 20px;">
      <div class="modal-content-burbuja animate__animated animate__zoomIn" style="background: #ffffff; width: 100%; max-width: 900px; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); overflow: hidden; display: flex; flex-direction: column; max-height: 85vh;">
        
        <div style="padding: 20px 24px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; background: #f9fafb; gap: 15px; flex-wrap: wrap;">
          <div>
            <h4 style="margin: 0; font-size: 1.25rem; font-weight: 700; color: #1f2937;">Estudiantes de ${targetClassName}</h4>
            <span id="modal-subtext-count" style="font-size: 0.85rem; color: #6b7280;">Total en esta sección: ${groupStudents.length}</span>
          </div>
          
          <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
            <button onclick="exportarExcelAulaActual()" class="btn btn-sm btn-accent" style="width: auto; padding: 8px 12px; font-weight: 600;">📥 Descargar Excel de esta aula</button>
            <input type="text" id="input-search-burbuja" placeholder="Buscar por nombre o DNI..." oninput="filtrarEstudiantesBurbuja()" style="padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.9rem; outline: none; width: 220px;" onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#d1d5db'">
          </div>

          <button onclick="cerrarBurbujaModal()" style="background: #e5e7eb; border: none; width: 32px; height: 32px; border-radius: 50%; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #374151; font-size: 1rem;">✕</button>
        </div>

        <div style="padding: 0; overflow-y: auto; flex-grow: 1;">
          <table class="table table-hover align-middle mb-0" style="width: 100%;">
            <thead class="table-light" style="position: sticky; top: 0; z-index: 1;">
              <tr>
                <th style="padding: 12px 20px;">DNI</th>
                <th style="padding: 12px 20px;">Estudiante</th>
                <th style="padding: 12px 20px;">Aula</th>
                <th style="padding: 12px 20px;">Pres. / Tar.</th>
                <th style="padding: 12px 20px;">Último Ingreso</th>
                <th style="padding: 12px 20px;">% Asist.</th>
                <th style="padding: 12px 20px; text-align: center;">Acciones</th>
              </tr>
            </thead>
            <tbody id="tabla-burbuja-body">
  `;

  tableHtml += generarFilasTablaBurbuja(groupStudents);

  tableHtml += `
            </tbody>
          </table>
        </div>

        <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; background: #f9fafb; text-align: right;">
          <button class="btn btn-secondary btn-sm" onclick="cerrarBurbujaModal()" style="border-radius: 8px; padding: 6px 16px; font-weight: 600;">Cerrar</button>
        </div>

      </div>
    </div>
  `;

  modalContainer.innerHTML = tableHtml;
}

function generarFilasTablaBurbuja(studentsArray) {
  if (studentsArray.length === 0) {
    return `<tr><td colspan="7" style="text-align: center; padding: 25px; color: #6b7280;">No se encontraron estudiantes coincidentes.</td></tr>`;
  }

  let rowsHtml = '';
  studentsArray.forEach(s => {
    const pct = totalSchoolDays > 0 ? Math.round((s.attendances / totalSchoolDays) * 100) : 0;
    let badgeClass = pct < 70 ? 'badge-low' : (pct < 85 ? 'badge-medium' : 'badge-high');
    const lastTimeDisplay = s.lastDate ? `${s.lastDate} ${s.lastTime}` : 'Sin registro';

    rowsHtml += `
      <tr>
        <td style="padding: 12px 20px;">${s.dni}</td>
        <td style="padding: 12px 20px;"><strong>${s.name}</strong></td>
        <td style="padding: 12px 20px;">${s.grade} "${s.section}"</td>
        <td style="padding: 12px 20px;">${s.attendances} / ${s.tardies}</td>
        <td style="padding: 12px 20px;"><small>${lastTimeDisplay}</small></td>
        <td style="padding: 12px 20px;"><span class="badge ${badgeClass}">${pct}%</span></td>
        <td style="padding: 12px 20px; text-align: center;">
          <div class="btn-action-group">
            <button class="btn-sm btn-info" onclick="showHistory('${s.dni}')">Historial</button>
            <button class="btn-sm btn-edit" onclick="openEditModal('${s.dni}')">Editar</button>
            <button class="btn-sm btn-danger" onclick="deleteStudent('${s.dni}')">Eliminar</button>
          </div>
        </td>
      </tr>
    `;
  });
  return rowsHtml;
}

function filtrarEstudiantesBurbuja() {
  const inputSearch = document.getElementById('input-search-burbuja');
  if (!inputSearch) return;

  const query = inputSearch.value.toLowerCase().trim();
  const allGroupStudents = window._currentModalStudents || [];

  const filtered = allGroupStudents.filter(s => {
    const nameMatch = s.name.toLowerCase().includes(query);
    const dniMatch = s.dni.toLowerCase().includes(query);
    return nameMatch || dniMatch;
  });

  const tbody = document.getElementById('tabla-burbuja-body');
  if (tbody) {
    tbody.innerHTML = generarFilasTablaBurbuja(filtered);
  }

  const subtextCount = document.getElementById('modal-subtext-count');
  if (subtextCount) {
    subtextCount.textContent = `Mostrando ${filtered.length} de ${allGroupStudents.length} estudiantes`;
  }
}

function cerrarBurbujaModal() {
  const modalContainer = document.getElementById('modal-burbuja-container');
  if (modalContainer) {
    modalContainer.innerHTML = '';
  }
  window._currentModalStudents = null;
}

// 5. ESTADÍSTICAS DEL DASHBOARD
function updateStats() {
  const statTotal = document.getElementById('stat-total');
  if (statTotal) statTotal.textContent = students.length;

  const todayStr = new Date().toISOString().split('T')[0];
  let presentsToday = 0;
  let tardiesToday = 0;
  let absentsToday = 0;

  students.forEach(s => {
    if (s.history) {
      const todayReg = s.history.find(h => h.date === todayStr);
      if (todayReg) {
        if (todayReg.status === 'Presente') presentsToday++;
        if (todayReg.status === 'Tarde') tardiesToday++;
        if (todayReg.status === 'Ausente') absentsToday++;
      }
    }
  });

  const statPres = document.getElementById('stat-presents');
  const statTar = document.getElementById('stat-tardies');
  const statAbs = document.getElementById('stat-absents');
  if (statPres) statPres.textContent = presentsToday;
  if (statTar) statTar.textContent = tardiesToday;
  if (statAbs) statAbs.textContent = absentsToday;

  actualizarGraficoAsistencia();
}

// ==========================================
// 6. GENERAR CARNETS QR POR GRADOS Y SECCIONES
// ==========================================
function renderizarCarnetsCredencial() {
  const gallery = document.getElementById('qr-gallery');
  if (!gallery) return;
  gallery.innerHTML = '';

  const mapaGrados = {
    '1': 'PRIMERO', '1°': 'PRIMERO', '1° SEC.': 'PRIMERO', 'PRIMERO': 'PRIMERO',
    '2': 'SEGUNDO', '2°': 'SEGUNDO', '2° SEC.': 'SEGUNDO', 'SEGUNDO': 'SEGUNDO',
    '3': 'TERCERO', '3°': 'TERCERO', '3° SEC.': 'TERCERO', 'TERCERO': 'TERCERO',
    '4': 'CUARTO', '4°': 'CUARTO', '4° SEC.': 'CUARTO', 'CUARTO': 'CUARTO',
    '5': 'QUINTO', '5°': 'QUINTO', '5° SEC.': 'QUINTO', 'QUINTO': 'QUINTO',
    '6': 'SEXTO', '6°': 'SEXTO', '6° SEC.': 'SEXTO', 'SEXTO': 'SEXTO'
  };

  // Agrupar estudiantes por aula
  const estudiantesPorAula = students.reduce((acc, student) => {
    let rawGrade = String(student.grade || 'Sin Grado').trim().toUpperCase();
    let numeroGrado = rawGrade.replace(/[^0-9]/g, '');
    let nombreGrado = mapaGrados[numeroGrado] || mapaGrados[rawGrade] || rawGrade;
    let seccionLimpia = String(student.section || 'Única').trim().toUpperCase();

    const key = `${nombreGrado} "${seccionLimpia}"`;

    if (!acc[key]) acc[key] = [];
    acc[key].push(student);
    return acc;
  }, {});

  if (Object.keys(estudiantesPorAula).length === 0) {
    gallery.innerHTML = `<div style="text-align: center; padding: 30px; color: #666; background: #fff; border-radius: 12px; width: 100%;">No hay estudiantes registrados.</div>`;
    return;
  }

  // Renderizado de carpetas/tarjetas de Aulas
  let htmlCarpetas = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; width: 100%;">`;

  for (const [nombreAula, listaEstudiantes] of Object.entries(estudiantesPorAula)) {
    let accentColor = nombreAula.includes('PRIMERO') || nombreAula.includes('SEGUNDO') ? '#f59e0b' : '#3b82f6';

    htmlCarpetas += `
      <div class="folder-card-item shadow-sm" style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; position: relative; overflow: hidden;">
        <div style="position: absolute; top: 0; left: 0; width: 6px; height: 100%; background-color: ${accentColor};"></div>
        <div class="d-flex justify-content-between align-items-center" style="cursor: pointer; padding-left: 8px;" onclick="abrirModalCarnetsAula('${nombreAula.replace(/[\s"]/g, '_')}')">
          <div>
            <h4 class="m-0" style="font-size: 1.15rem; font-weight: 700; color: #1f2937;">📁 Carnets de ${nombreAula}</h4>
            <span style="font-size: 0.85rem; color: #6b7280; font-weight: 500; margin-top: 4px; display: inline-block;">${listaEstudiantes.length} carnets disponibles</span>
          </div>
          <button class="btn btn-sm" style="background: #f3f4f6; color: #374151; font-weight: 600; border-radius: 8px; padding: 6px 12px; border: none;">Ver →</button>
        </div>
      </div>
    `;
  }
  htmlCarpetas += `</div><div id="modal-carnets-aula-container"></div>`;

  gallery.innerHTML = htmlCarpetas;
  window._estudiantesPorAulaCarnets = estudiantesPorAula;
}

// Modal para visualizar e imprimir carnets de una sección específica
function abrirModalCarnetsAula(aulaKey) {
  const dataMap = window._estudiantesPorAulaCarnets || {};
  let nombreAula = '';
  let listaEstudiantes = [];

  for (const [key, arr] of Object.entries(dataMap)) {
    if (key.replace(/[\s"]/g, '_') === aulaKey) {
      nombreAula = key;
      listaEstudiantes = arr;
      break;
    }
  }

  let container = document.getElementById('modal-carnets-aula-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'modal-carnets-aula-container';
    document.body.appendChild(container);
  }

  let modalHtml = `
    <div class="modal-backdrop-burbuja" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.6); display: flex; justify-content: center; align-items: center; z-index: 1050; padding: 15px;">
      <div class="modal-content-burbuja" style="background: #ffffff; width: 100%; max-width: 950px; border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; max-height: 90vh;">
        
        <div style="padding: 16px 24px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; background: #f9fafb;">
          <div>
            <h4 style="margin: 0; font-size: 1.2rem; font-weight: 700; color: #1f2937;">Carnets de ${nombreAula}</h4>
            <span style="font-size: 0.85rem; color: #6b7280;">Total: ${listaEstudiantes.length} estudiantes</span>
          </div>
          <div style="display: flex; gap: 10px;">
            <button onclick="imprimirCarnetsAula()" class="btn btn-accent btn-sm" style="width: auto; padding: 6px 14px;">🖨️ Imprimir Esta Aula</button>
            <button onclick="cerrarModalCarnetsAula()" style="background: #e5e7eb; border: none; width: 32px; height: 32px; border-radius: 50%; font-weight: bold; cursor: pointer;">✕</button>
          </div>
        </div>

        <div id="modal-carnets-body" style="padding: 20px; overflow-y: auto; flex-grow: 1; display: flex; flex-wrap: wrap; gap: 15px; justify-content: center; background: #f3f4f6;">
  `;

  listaEstudiantes.forEach(est => {
    let fotoSrc = est.foto ? est.foto : '';
    modalHtml += `
      <div class="qr-card carnet-credencial" style="margin: 0;">
        <div style="display: flex; width: 100%;">
          <div class="carnet-left" style="width: 45%;">
            <div class="carnet-photo-box" onclick="abrirModalSubirFoto('${est.dni}', '${est.name || est.nombre}')" title="Haz clic para subir foto" style="cursor: pointer; height: 100px; border: 1px dashed #ccc; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 6px;">
              ${fotoSrc ? `<img src="${fotoSrc}" alt="Foto" style="width: 100%; height: 100%; object-fit: cover;">` : `<div style="font-size:2rem; text-align:center; color:#6c757d;">👤</div>`}
            </div>
            <div class="carnet-footer-left" style="display: flex; align-items: center; margin-top: 6px; gap: 4px;">
              <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQJaEC9lZWlZ-oCP8mZfecwDroVpB2O_hR9Vs8RGTRN0w&s=10" class="carnet-badge-logo" alt="Logo" style="width: 20px; height: 20px;">
              <div class="carnet-school-text" style="font-size: 0.5rem; line-height: 1.1;">
                COLEGIO RICARDO<br>BENTÍN 64935<br>
                <span style="font-weight: 500; font-size: 0.45rem;">ESTUDIANTE</span>
              </div>
            </div>
          </div>
          <div class="carnet-right" style="width: 55%; padding-left: 8px; text-align: left;">
            <div class="carnet-name" style="font-size: 0.75rem; font-weight: bold; margin-bottom: 2px;">${est.name || est.nombre}</div>
            <div class="carnet-info-sub" style="font-size: 0.6rem; color: #555; margin-bottom: 4px;">${est.grade || est.grado}° "${est.section || est.seccion}"<br>DNI: ${est.dni}</div>
            <div class="carnet-qr-container qr-container qr-card-${est.dni}" id="qr-card-${est.dni}"></div>
          </div>
        </div>
      </div>
    `;
  });

  modalHtml += `
        </div>
        <div style="padding: 12px 24px; border-top: 1px solid #e5e7eb; background: #f9fafb; text-align: right;">
          <button class="btn btn-secondary btn-sm" onclick="cerrarModalCarnetsAula()" style="width: auto; padding: 6px 16px;">Cerrar</button>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = modalHtml;

  // Generar códigos QR tras renderizar en el DOM
  setTimeout(() => {
    listaEstudiantes.forEach(est => {
      const qrBox = document.getElementById(`qr-card-${est.dni}`);
      if (qrBox && typeof QRCode !== 'undefined') {
        qrBox.innerHTML = '';
        new QRCode(qrBox, { text: est.dni, width: 75, height: 75 });
      }
    });
  }, 100);
}

function cerrarModalCarnetsAula() {
  const container = document.getElementById('modal-carnets-aula-container');
  if (container) container.innerHTML = '';
}

// Función actualizada para imprimir agrupando exactamente de 4 en 4 carnets por página
function imprimirCarnetsAula() {
  const modalBody = document.getElementById('modal-carnets-body');
  if (!modalBody) return;

  let printArea = document.getElementById('print-area-container');
  if (!printArea) {
    printArea = document.createElement('div');
    printArea.id = 'print-area-container';
    document.body.appendChild(printArea);
  }
  printArea.innerHTML = '';

  const cards = Array.from(modalBody.querySelectorAll('.carnet-credencial'));

  // Agrupar de 4 en 4 carnets por cada página de impresión
  for (let i = 0; i < cards.length; i += 4) {
    const pageWrapper = document.createElement('div');
    pageWrapper.className = 'print-page';
    
    cards.slice(i, i + 4).forEach(card => {
      const clone = card.cloneNode(true);
      pageWrapper.appendChild(clone);
    });

    printArea.appendChild(pageWrapper);
  }

  cards.forEach(card => {
    const qrDiv = card.querySelector('.qr-container');
    if (qrDiv) {
      const dni = qrDiv.id.replace('qr-card-', '');
      const clonedQrDiv = printArea.querySelector(`#qr-card-${dni}`);
      if (clonedQrDiv && typeof QRCode !== 'undefined') {
        clonedQrDiv.innerHTML = '';
        new QRCode(clonedQrDiv, { text: dni, width: 75, height: 75 });
      }
    }
  });

  window.print();
}

function abrirModalSubirFoto(dni, nombre) {
  const dniInput = document.getElementById('foto-estudiante-dni');
  const labelNombre = document.getElementById('label-nombre-foto-estudiante');
  const inputArchivo = document.getElementById('input-archivo-foto-estudiante');

  if (dniInput) dniInput.value = dni;
  if (labelNombre) labelNombre.innerText = `Estudiante: ${nombre} (DNI: ${dni})`;
  if (inputArchivo) inputArchivo.value = '';

  const modalEl = document.getElementById('modalSubirFotoEstudiante');
  if (modalEl) {
    var myModal = new bootstrap.Modal(modalEl);
    myModal.show();
  }
}

document.getElementById('formSubirFotoEstudiante')?.addEventListener('submit', function(e) {
  e.preventDefault();
  const dni = document.getElementById('foto-estudiante-dni').value;
  const fileInput = document.getElementById('input-archivo-foto-estudiante');
  
  if (fileInput.files && fileInput.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const base64Image = e.target.result;
      let alumno = students.find(s => s.dni === dni);
      if (alumno) {
        alumno.foto = base64Image;
        try {
          localStorage.setItem('students_backup', JSON.stringify(students));
        } catch(err) {}

        renderizarCarnetsCredencial();

        var modalEl = document.getElementById('modalSubirFotoEstudiante');
        var modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      }
    };
    reader.readAsDataURL(fileInput.files[0]);
  }
});

// 7. OPERACIONES DE CONTROL
async function nextDay() {
  if (confirm('¿Desea iniciar un nuevo día lectivo? Esto registrará las ausencias pendientes del día actual, incrementará el acumulado de días y reiniciará el contador diario a cero.')) {
    try {
      await fetch('api.php?action=mark_absents', { method: 'POST' });
      const res = await fetch('api.php?action=next_day', { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        alert("¡Nuevo día lectivo iniciado con éxito! Los contadores diarios se han reiniciado.");
        loadDataFromDB();
      } else {
        alert("Error al iniciar el nuevo día: " + (data.message || "Intente nuevamente."));
      }
    } catch (e) {
      console.error("Error de conexión:", e);
      alert("Error al conectar con el servidor.");
    }
  }
}

async function markAllAbsent() {
  if (confirm('¿Marcar como Ausentes a todos los estudiantes que no registraron ingreso hoy?')) {
    const res = await fetch('api.php?action=mark_absents', { method: 'POST' });
    const data = await res.json();
    alert(`Se marcaron ${data.count} ausencias.`);
    loadDataFromDB();
  }
}

async function deleteStudent(dni) {
  if (confirm(`¿Está seguro de eliminar al estudiante con DNI ${dni}?`)) {
    const res = await fetch('api.php?action=delete_student', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dni })
    });

    if (res.ok) {
      loadDataFromDB();
    } else {
      alert('Error al eliminar estudiante.');
    }
  }
}

// 8. ESCÁNER QR
function initQrScanner() {
  const readerEl = document.getElementById("reader");
  if (!readerEl) return;

  html5QrcodeScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 220 });
  html5QrcodeScanner.render((decodedText) => {
    processAttendance(decodedText.trim());
  }, (error) => {});
}

// 9. NAVEGACIÓN Y MODALES
function switchTab(tabName, event) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  
  document.getElementById(`tab-${tabName}`)?.classList.add('active');
  if (event) event.target.classList.add('active');

  if (tabName === 'estudiantes') {
    renderTable();
    updateStats();
  }
  if (tabName === 'carnets') {
    renderizarCarnetsCredencial();
  }
}

function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
}

function openConfigModal() { document.getElementById('config-modal')?.classList.add('active'); }
function closeConfigModal() { document.getElementById('config-modal')?.classList.remove('active'); }

function openEditModal(dni) {
  const student = students.find(s => s.dni === dni);
  if (!student) return;

  document.getElementById('edit-original-dni').value = student.dni;
  document.getElementById('edit-dni').value = student.dni;
  document.getElementById('edit-name').value = student.name;
  document.getElementById('edit-grade').value = student.grade;
  document.getElementById('edit-section').value = student.section;

  const editModal = document.getElementById('edit-modal');
  if (editModal) {
    editModal.classList.add('active');
    editModal.style.zIndex = "1070"; 
  }
}

function closeEditModal() {  
  document.getElementById('edit-modal')?.classList.remove('active');  
}

function showHistory(dni) {
  const student = students.find(s => s.dni === dni);
  if (!student) return;

  const tbody = document.getElementById('history-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!student.history || student.history.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Sin registros de asistencia</td></tr>';
  } else {
    student.history.forEach(h => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${h.date}</td>
        <td>${h.time || '--:--'}</td>
        <td><strong>${h.status}</strong></td>
        <td style="text-align: center;">
          <div class="btn-action-group" style="display: flex; gap: 4px; justify-content: center;">
            <button class="btn-sm btn-info" onclick="editarRegistroAsistencia('${student.dni}', '${h.date}', '${h.status}')" style="padding: 2px 6px; font-size: 0.75rem;">✏️ Editar</button>
            <button class="btn-sm btn-danger" onclick="eliminarRegistroAsistencia('${student.dni}', '${h.date}')" style="padding: 2px 6px; font-size: 0.75rem;">🗑️ Eliminar</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  const historyModal = document.getElementById('history-modal');
  if (historyModal) {
    historyModal.classList.add('active');
    historyModal.style.zIndex = "1070"; 
  }
}

function closeHistoryModal() {  
  document.getElementById('history-modal')?.classList.remove('active');  
}

// ==========================================
// MÓDULO: MODAL DETALLE DE ESTADOS
// ==========================================
let estadoActualModal = '';

function abrirModalDetalle(estado) {
  estadoActualModal = estado;
  const modal = document.getElementById('modal-detalle-estado');
  const titulo = document.getElementById('modal-detalle-titulo');
  
  if (titulo) {
    titulo.textContent = `Estudiantes con estado: ${estado.toUpperCase()}`;
  }
  
  document.getElementById('filtro-modal-grado').value = 'all';
  document.getElementById('filtro-modal-seccion').value = 'all';

  renderizarTablaDetalleState();

  if (modal) {
    modal.style.display = 'flex';
  }
}

function cerrarModalDetalle() {
  const modal = document.getElementById('modal-detalle-estado');
  if (modal) {
    modal.style.display = 'none';
  }
}

function renderizarTablaDetalleState() {
  const tbody = document.getElementById('tabla-detalle-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const gradoFiltro = document.getElementById('filtro-modal-grado').value;
  const seccionFiltro = document.getElementById('filtro-modal-seccion').value;
  const todayStr = new Date().toISOString().split('T')[0];

  const estudiantesFiltrados = students.filter(s => {
    const matchGrado = gradoFiltro === 'all' || String(s.grade).includes(gradoFiltro);
    const matchSeccion = seccionFiltro === 'all' || String(s.section).toUpperCase() === String(seccionFiltro).toUpperCase();
    const todayReg = s.history ? s.history.find(h => h.date === todayStr) : null;

    let matchEstado = false;
    if (estadoActualModal === 'Presente') {
      matchEstado = todayReg && todayReg.status === 'Presente';
    } else if (estadoActualModal === 'Tarde') {
      matchEstado = todayReg && todayReg.status === 'Tarde';
    } else if (estadoActualModal === 'Ausente') {
      matchEstado = (!todayReg || todayReg.status === 'Ausente');
    }

    return matchGrado && matchSeccion && matchEstado;
  });

  if (estudiantesFiltrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: #666;">No se encontraron estudiantes en esta categoría.</td></tr>`;
    return;
  }

  estudiantesFiltrados.forEach(s => {
    const todayReg = s.history ? s.history.find(h => h.date === todayStr) : null;
    const horaRegistro = todayReg && todayReg.time ? todayReg.time : '--:--';

    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--border, #eee)';
    tr.innerHTML = `
      <td style="padding: 10px;">${s.dni}</td>
      <td style="padding: 10px;"><strong>${s.name}</strong></td>
      <td style="padding: 10px;">${s.grade}° "${s.section}"</td>
      <td style="padding: 10px;">${horaRegistro}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function editarRegistroAsistencia(dni, fecha, estadoActual) {
  const nuevoEstado = prompt(`Editar estado para el día ${fecha}\n(Escribe: Presente, Tarde, o Ausente):`, estadoActual);
  if (!nuevoEstado) return;

  const estadoValido = nuevoEstado.trim();
  if (!['Presente', 'Tarde', 'Ausente'].includes(estadoValido)) {
    alert("Estado inválido. Debe ser: Presente, Tarde o Ausente.");
    return;
  }

  try {
    const res = await fetch('api.php?action=edit_attendance_record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dni, fecha, status: estadoValido })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      alert("Registro actualizado correctamente.");
      await loadDataFromDB();
      showHistory(dni);
    } else {
      alert("Error: " + (data.message || "No se pudo actualizar el registro."));
    }
  } catch (e) {
    console.error("Error de conexión:", e);
    alert("Error al conectar con la base de datos.");
  }
}

async function eliminarRegistroAsistencia(dni, fecha) {
  if (confirm(`¿Estás seguro de eliminar el registro de asistencia del día ${fecha} para este estudiante?`)) {
    try {
      const res = await fetch('api.php?action=delete_attendance_record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni, fecha })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert("Registro eliminado correctamente.");
        await loadDataFromDB();
        showHistory(dni);
      } else {
        alert("Error: " + (data.message || "No se pudo eliminar el registro."));
      }
    } catch (e) {
      console.error("Error de conexión:", e);
      alert("Error al conectar con la base de datos.");
    }
  }
}

function showAlert(el, msg, type) {
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function exportToCSV() {
  let csvContent = "\uFEFF"; 
  csvContent += "DNI;Estudiante;Grado;Seccion;Asistencias;Tardanzas\n";

  students.forEach(s => {
    const dni = s.dni || "";
    const name = (s.name || "").replace(/;/g, ""); 
    const grade = s.grade || "";
    const section = s.section || "";
    const attendances = s.attendances || 0;
    const tardies = s.tardies || 0;

    csvContent += `${dni};"${name}";${grade};"${section}";${attendances};${tardies}\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Reporte_Asistencia_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportBackupJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(students));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `backup_estudiantes_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importBackupJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const importedData = JSON.parse(e.target.result);
      if (Array.isArray(importedData)) {
        for (const st of importedData) {
          await fetch('api.php?action=add_student', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dni: st.dni, name: st.name || st.nombre, grade: st.grade || st.grado, section: st.section || st.seccion })
          });
        }
        alert('Copia de seguridad importada con éxito.');
        loadDataFromDB();
      }
    } catch (err) {
      alert('Error al procesar el archivo JSON.');
    }
  };
  reader.readAsText(file);
}

// ==========================================
// CALENDARIO INTERACTIVO DE ASISTENCIA
// ==========================================
async function cargarExcepcionesCalendario() {
  try {
    const res = await fetch('api.php?action=get_students');
    const data = await res.json();
    renderizarCalendarioInteractivo();
  } catch (e) {
    renderizarCalendarioInteractivo();
  }
}

function cambiarMesCalendario(direccion) {
  fechaActualCal.setMonth(fechaActualCal.getMonth() + direccion);
  renderizarCalendarioInteractivo();
}

async function renderizarCalendarioInteractivo() {
  const grid = document.getElementById('calendar-grid');
  const tituloMes = document.getElementById('mes-anio-titulo');
  if (!grid || !tituloMes) return;

  grid.innerHTML = '';
  const anio = fechaActualCal.getFullYear();
  const mes = fechaActualCal.getMonth();

  const nombresMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  tituloMes.textContent = `${nombresMeses[mes]} ${anio}`;

  const primerDiaIndex = new Date(anio, mes, 1).getDay();
  const ajusteLunes = primerDiaIndex === 0 ? 6 : primerDiaIndex - 1;
  const totalDias = new Date(anio, mes + 1, 0).getDate();

  for (let i = 0; i < ajusteLunes; i++) {
    const vacio = document.createElement('div');
    grid.appendChild(vacio);
  }

  for (let dia = 1; dia <= totalDias; dia++) {
    const mesStr = String(mes + 1).padStart(2, '0');
    const diaStr = String(dia).padStart(2, '0');
    const fechaStr = `${anio}-${mesStr}-${diaStr}`;

    const cell = document.createElement('div');
    cell.style.cssText = "padding: 10px 5px; text-align: center; border-radius: 8px; border: 1px solid var(--border); cursor: pointer; background: var(--card-bg); font-weight: 600; font-size: 0.85rem; transition: transform 0.1s;";
    cell.textContent = dia;

    cell.onclick = () => abrirResumenFecha(fechaStr);

    fetch(`api.php?action=get_date_summary&fecha=${fechaStr}`)
      .then(res => res.json())
      .then(data => {
        if (data.tipo_dia === 'feriado') {
          cell.style.backgroundColor = '#fee2e2';
          cell.style.color = '#b91c1c';
          cell.title = "Feriado";
        } else if (data.tipo_dia === 'sin_clases') {
          cell.style.backgroundColor = '#fef3c7';
          cell.style.color = '#d97706';
          cell.title = "Sin Clases";
        } else {
          cell.style.backgroundColor = 'var(--card-bg)';
        }
      }).catch(err => {});

    grid.appendChild(cell);
  }
}

async function abrirResumenFecha(fecha) {
  fechaSeleccionadaGlobal = fecha;
  const tituloModal = document.getElementById('modal-fecha-titulo');
  if (tituloModal) tituloModal.textContent = `Detalle de Asistencia - Fecha: ${fecha}`;
  
  try {
    const res = await fetch(`api.php?action=get_date_summary&fecha=${fecha}`);
    const data = await res.json();

    if (data.success) {
      document.getElementById('select-tipo-dia').value = data.tipo_dia || 'lectivo';
      document.getElementById('res-total').textContent = data.total_estudiantes || 0;
      document.getElementById('res-presentes').textContent = data.presentes || 0;
      document.getElementById('res-tardanzas').textContent = data.tardanzas || 0;
      document.getElementById('res-ausentes').textContent = data.ausentes || 0;
      document.getElementById('res-justificados').textContent = data.justificados || 0;

      renderizarTablaDetallePorFecha(data.estudiantes_fecha || []);
    }
  } catch (e) {
    console.error("Error al obtener resumen de la fecha:", e);
  }

  const modalResumen = document.getElementById('modal-resumen-fecha');
  if (modalResumen) modalResumen.classList.add('active');
}

function renderizarTablaDetallePorFecha(listaEstudiantes) {
  let contenedorTabla = document.getElementById('detalle-alumnos-fecha-container');
  
  if (!contenedorTabla) {
    const modalBody = document.querySelector('#modal-resumen-fecha .modal-body') || document.getElementById('modal-resumen-fecha');
    contenedorTabla = document.createElement('div');
    contenedorTabla.id = 'detalle-alumnos-fecha-container';
    contenedorTabla.style.cssText = "margin-top: 15px; max-height: 250px; overflow-y: auto; border: 1px solid #ddd; border-radius: 6px;";
    modalBody.appendChild(contenedorTabla);
  }

  if (listaEstudiantes.length === 0) {
    contenedorTabla.innerHTML = `<p style="text-align: center; padding: 10px; color: #666; font-size: 0.85rem;">No hay registros detallados para esta fecha.</p>`;
    return;
  }

  let html = `
    <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
      <thead>
        <tr style="background: #f1f1f1; text-align: left;">
          <th style="padding: 6px;">Estudiante</th>
          <th style="padding: 6px;">Grado/Sección</th>
          <th style="padding: 6px;">Estado</th>
          <th style="padding: 6px;">Hora</th>
        </tr>
      </thead>
      <tbody>
  `;

  listaEstudiantes.forEach(item => {
    let colorEstado = '#28a745';
    if (item.status === 'Tarde') colorEstado = '#ffc107';
    if (item.status === 'Ausente') colorEstado = '#dc3545';

    html += `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 6px;">${item.name}</td>
        <td style="padding: 6px;">${item.grade}° "${item.section}"</td>
        <td style="padding: 6px;"><span style="color: ${colorEstado}; font-weight: bold;">${item.status}</span></td>
        <td style="padding: 6px;">${item.time || '--:--'}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  contenedorTabla.innerHTML = html;
}

function cerrarModalResumenFecha() {
  document.getElementById('modal-resumen-fecha')?.classList.remove('active');
  renderizarCalendarioInteractivo();
}

async function actualizarTipoDiaSeleccionado() {
  const nuevoTipo = document.getElementById('select-tipo-dia').value;
  
  try {
    const res = await fetch('api.php?action=save_calendar_day', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha: fechaSeleccionadaGlobal, tipo: nuevoTipo })
    });
    const data = await res.json();
    if (!res.ok) {
      alert("Error al actualizar el día en el calendario.");
    }
  } catch (e) {
    console.error("Error de conexión:", e);
  }
}

async function justificarAsistencia(dni, fecha) {
  const motivo = prompt("Ingrese el motivo de la justificación:");
  if (!motivo) return;

  try {
    const res = await fetch('api.php?action=justificar_asistencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dni, fecha, motivo })
    });
    const data = await res.json();
    if (res.ok) {
      alert("Asistencia justificada correctamente.");
      loadDataFromDB();
      closeHistoryModal();
    } else {
      alert(data.message || "Error al justificar.");
    }
  } catch (e) {
    alert("Error de conexión.");
  }
}

function renderCalendarioEditable() {
  const calContainer = document.getElementById('calendario-container');
  if (!calContainer) return;

  const hoy = new Date();
  const mes = hoy.getMonth();
  const anio = hoy.getFullYear();

  calContainer.innerHTML = `
    <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; border: 1px solid #ddd;">
      <h4>Calendario Lectivo y Horarios (AM / PM)</h4>
      <p>Días acumulados actuales: <strong id="lbl-dias-acumulados">${totalSchoolDays}</strong> <button onclick="editarDiasAcumulados()" class="btn-sm">Editar</button></p>
      <p>Límite configurado: <input type="time" id="input-hora-flexible" value="${lateTimeLimit}" onchange="actualizarHoraFlexible(this.value)"> (Soporta cualquier hora AM/PM)</p>
      <div id="grid-dias-mes" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; margin-top: 10px;"></div>
    </div>
  `;

  const gridDias = document.getElementById('grid-dias-mes');
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();

  for (let d = 1; d <= diasEnMes; d++) {
    const diaBox = document.createElement('div');
    diaBox.style.padding = "8px";
    diaBox.style.textAlign = "center";
    diaBox.style.background = "#d4edda";
    diaBox.style.border = "1px solid #c3e6cb";
    diaBox.style.cursor = "pointer";
    diaBox.textContent = d;
    
    diaBox.onclick = () => {
      diaBox.style.background = diaBox.style.background === "rgb(212, 237, 218)" ? "#f8d7da" : "#d4edda";
      alert(`Estado del día ${d} modificado en el calendario.`);
    };
    gridDias.appendChild(diaBox);
  }
}

async function editarDiasAcumulados() {
  const nuevosDias = prompt("Ingrese el nuevo total de días acumulados:", totalSchoolDays);
  if (nuevosDias !== null && !isNaN(nuevosDias) && nuevosDias.trim() !== "") {
    totalSchoolDays = parseInt(nuevosDias);
    
    const totalDaysEl = document.getElementById('total-days');
    if (totalDaysEl) totalDaysEl.textContent = totalSchoolDays;

    const lblDias = document.getElementById('lbl-dias-acumulados');
    if (lblDias) lblDias.textContent = totalSchoolDays;

    try {
      const res = await fetch('api.php?action=update_total_dias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ total: totalSchoolDays })
      });
      if (!res.ok) alert("No se pudo guardar en la base de datos.");
    } catch (e) {
      console.error("Error de conexión:", e);
    }
  }
}

async function editarLimitePuntualidad() {
  const nuevaHora = prompt("Ingrese la nueva hora límite (Formato HH:MM, ej. 08:00):", lateTimeLimit);
  if (nuevaHora !== null && nuevaHora.trim() !== "") {
    lateTimeLimit = nuevaHora.trim();
    
    const displayTimeEl = document.getElementById('display-limit-time');
    if (displayTimeEl) displayTimeEl.textContent = lateTimeLimit;

    const schoolNameEl = document.getElementById('cfg-school-name');
    const schoolName = schoolNameEl ? schoolNameEl.value : "";

    try {
      const res = await fetch('api.php?action=save_config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          schoolName: schoolName, 
          limitTime: lateTimeLimit.length === 5 ? lateTimeLimit + ":00" : lateTimeLimit 
        })
      });
      
      if (res.ok) {
        alert("Hora límite actualizada correctamente.");
      } else {
        alert("Error al guardar la hora límite.");
      }
    } catch (e) {
      console.error("Error de conexión:", e);
    }
  }
}

async function actualizarHoraFlexible(nuevaHora) {
  lateTimeLimit = nuevaHora;
  alert(`Hora límite actualizada a: ${nuevaHora}`);
}

// ==========================================
// DIRECTORIO DE PROFESORES: TARJETAS, CRUD Y FOTOS
// ==========================================
function cargarProfesores() {
    fetch('api.php?action=get_profesores')
        .then(res => res.json())
        .then(data => {
            const grid = document.getElementById('gridProfesores');
            if (!grid) return;
            grid.innerHTML = '';

            if (!data.profesores || data.profesores.length === 0) {
                grid.innerHTML = '<p class="text-muted text-center w-100">No hay profesores registrados.</p>';
                return;
            }

            data.profesores.forEach(prof => {
                const fotoSrc = prof.foto && prof.foto !== "" ? prof.foto : 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/person-circle.svg';
                
                const card = `
                    <div class="col-md-4 mb-3">
                        <div class="card h-100 shadow-sm text-center p-3 position-relative">
                            <div class="mx-auto mb-3" style="width: 100px; height: 100px; overflow: hidden; border-radius: 50%;">
                                <img src="${fotoSrc}" alt="${prof.nombre_completo}" class="w-100 h-100 object-fit-cover" style="cursor: pointer;" onclick="verImagenCompleta('${fotoSrc}')">
                            </div>
                            <div class="card-body p-0 mb-3">
                                <h5 class="card-title mb-1">${prof.nombre_completo}</h5>
                                <p class="text-primary fw-semibold mb-2">${prof.especialidad}</p>
                                <p class="text-muted small mb-0">DNI: ${prof.dni}</p>
                            </div>
                            <div class="d-flex justify-content-center gap-2 mt-auto">
                                <button class="btn btn-sm btn-outline-primary" onclick="abrirEditarProfesor('${prof.dni}', '${prof.nombre_completo}', '${prof.especialidad}')">
                                    <i class="bi bi-pencil-fill"></i> Editar
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="eliminarProfesor('${prof.dni}')">
                                    <i class="bi bi-trash-fill"></i> Eliminar
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                grid.innerHTML += card;
            });
        })
        .catch(err => console.error("Error al cargar profesores:", err));
}

async function eliminarProfesor(dni) {
    if (confirm(`¿Está seguro de eliminar al profesor con DNI ${dni}?`)) {
        try {
            const res = await fetch('api.php?action=delete_profesor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dni })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                alert("Profesor eliminado correctamente.");
                cargarProfesores();
            } else {
                alert("Error: " + (data.message || "No se pudo eliminar."));
            }
        } catch (err) {
            console.error("Error:", err);
            alert("Error de conexión al eliminar profesor.");
        }
    }
}

function abrirEditarProfesor(dni, nombre, especialidad) {
    document.getElementById('edit-prof-original-dni').value = dni;
    document.getElementById('edit-prof-dni').value = dni;
    document.getElementById('edit-prof-nombre').value = nombre;
    document.getElementById('edit-prof-especialidad').value = especialidad;
    document.getElementById('edit-prof-foto').value = ""; 

    const modalEl = document.getElementById('modalEditarProfesor');
    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

const formProfesorEl = document.getElementById('formProfesor');
if (formProfesorEl) {
    formProfesorEl.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(this);

        fetch('api.php?action=add_profesor_foto', {
            method: 'POST',
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert(data.message);
                const modalEl = document.getElementById('modalProfesor');
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
                this.reset();
                cargarProfesores();
            } else {
                alert("Error: " + data.message);
            }
        })
        .catch(err => console.error("Error en la petición:", err));
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const formEditarProfesor = document.getElementById('formEditarProfesor');
    if (formEditarProfesor) {
        formEditarProfesor.addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(this);

            fetch('api.php?action=edit_profesor', {
                method: 'POST',
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    alert(data.message);
                    const modalEl = document.getElementById('modalEditarProfesor');
                    const modal = bootstrap.Modal.getInstance(modalEl);
                    if (modal) modal.hide();
                    cargarProfesores();
                } else {
                    alert("Error: " + data.message);
                }
            })
            .catch(err => {
                console.error("Error:", err);
                alert("Ocurrió un error al actualizar el profesor.");
            });
        });
    }
});

// ==========================================
// NUEVA FUNCIÓN: EXPORTAR EXCEL POR AULA ACTUAL
// ==========================================
function exportarExcelAulaActual() {
  const listaAlumnosAula = window._currentModalStudents || [];
  const nombreAulaTitulo = window._currentClassNameTitle || "Reporte_Aula";

  if (listaAlumnosAula.length === 0) {
    alert("No hay estudiantes en esta sección para exportar.");
    return;
  }

  let csvContent = "\uFEFF"; 
  csvContent += `DNI;Estudiante;Grado;Seccion;Asistencias;Tardanzas\n`;

  listaAlumnosAula.forEach(s => {
    const dni = s.dni || "";
    const name = (s.name || "").replace(/;/g, ""); 
    const grade = s.grade || "";
    const section = s.section || "";
    const attendances = s.attendances || 0;
    const tardies = s.tardies || 0;

    csvContent += `${dni};"${name}";${grade};"${section}";${attendances};${tardies}\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Reporte_${nombreAulaTitulo.replace(/[\s"]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}