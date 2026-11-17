import Swal from 'sweetalert2';

export async function confirmDialog(opts: {
  title: string;
  text?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}): Promise<boolean> {
  const r = await Swal.fire({
    title: opts.title,
    text: opts.text,
    showCancelButton: true,
    confirmButtonText: opts.confirmText ?? 'Aceptar',
    cancelButtonText: opts.cancelText ?? 'Cancelar',
    reverseButtons: true,
    focusCancel: !!opts.danger,
    buttonsStyling: false,
    customClass: {
      popup: 'ls-swal',
      confirmButton: opts.danger ? 'btn danger' : 'btn',
      cancelButton: 'btn secondary'
    }
  });
  return r.isConfirmed;
}