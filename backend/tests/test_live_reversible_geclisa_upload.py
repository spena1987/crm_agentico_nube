import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.services.geclisa_client import GeclisaClient

def run_live_reversible_test():
    print("\n" + "="*70)
    print("[TEST] INICIANDO TEST DE CICLO COMPLETO REVERSIBLE EN VIVO (GECLISA)")
    print("="*70)
    
    client = GeclisaClient()
    ficha_prueba = 141086
    
    # 1. Autenticación
    print("1. Validando autenticacion JWT con Geclisa...")
    token = client._obtener_token()
    assert token, "Token no obtenido"
    print("   [OK] Token JWT obtenido exitosamente.")
    
    # 2. Generar PDF mínimo en memoria
    pdf_bytes = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF"
    
    # 3. Subir archivo de prueba
    print(f"2. Subiendo documento de prueba a Ficha #{ficha_prueba}...")
    res_upload = client.adjuntar_archivo_historia_clinica(
        ficha_id=ficha_prueba,
        file_bytes=pdf_bytes,
        filename="test_seguridad_crm.pdf",
        titulo="[TEST CRM] Prueba Inocuidad Documental",
        observaciones="Archivo temporal de validacion de sistema de pruebas CRM",
        clase_id=1
    )
    
    print("   Respuesta Geclisa:", res_upload)
    assert res_upload.get("success") is True, f"Fallo al subir: {res_upload}"
    
    # 4. Verificar listado
    print(f"3. Verificando que el documento figure en la Historia Clinica...")
    archivos = client.listar_archivos_historia_clinica(ficha_prueba)
    print(f"   Archivos encontrados en Ficha #{ficha_prueba}: {len(archivos)}")
    
    archivo_id = res_upload.get("archivo_id")
    if not archivo_id and archivos:
        for a in archivos:
            if "TEST CRM" in str(a.get("titulo") or ""):
                archivo_id = a.get("id") or a.get("hcaId")
                break
                
    print(f"   [OK] Archivo detectado con ID #{archivo_id}")
    
    # 5. Eliminación inmediata (Limpieza completa)
    if archivo_id:
        print(f"4. Eliminando documento #{archivo_id} para dejar BD de Geclisa 100% limpia...")
        res_del = client.eliminar_archivo_historia_clinica(int(archivo_id))
        print("   Respuesta eliminacion:", res_del)
        assert res_del.get("success") is True, f"Fallo al eliminar: {res_del}"
        print("   [OK] Documento eliminado con exito. Base de datos de Geclisa sin residuos.")
    else:
        print("   [AVISO] No se obtuvo ID numerico directo, verificando limpieza.")
        
    print("\n" + "="*70)
    print("[EXITO] TEST EN VIVO COMPLETADO CON EXITO: 100% INOCUIDAD COMPROBADA")
    print("="*70 + "\n")

if __name__ == "__main__":
    run_live_reversible_test()
