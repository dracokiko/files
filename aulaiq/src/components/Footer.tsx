export default function Footer() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
                <span className="text-white font-black text-sm">S</span>
              </div>
              <span className="font-black text-xl text-white">StudyLab</span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed max-w-sm">
              Estudo universitário, feito à tua medida.
            </p>
            <p className="mt-2 text-xs text-gray-500 max-w-sm">
              A primeira plataforma de estudo com IA pensada especificamente para estudantes universitários portugueses.
            </p>
            {/* Social placeholders */}
            <div className="flex items-center gap-3 mt-5">
              {['Instagram', 'Twitter', 'LinkedIn'].map((social) => (
                <div
                  key={social}
                  title={social}
                  className="w-9 h-9 rounded-xl bg-gray-800 hover:bg-gray-700 flex items-center justify-center cursor-pointer transition-colors"
                >
                  <span className="text-xs font-bold text-gray-400">
                    {social.charAt(0)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Plataforma</h4>
            <ul className="space-y-2.5">
              {[
                { label: 'Como funciona', id: 'como-funciona' },
                { label: 'Faculdades', id: 'faculdades' },
                { label: 'Planos', id: 'planos' },
                { label: 'FAQ', id: 'faq' },
              ].map((link) => (
                <li key={link.id}>
                  <button
                    onClick={() => scrollTo(link.id)}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-2.5">
              {['Termos de Serviço', 'Política de Privacidade', 'Cookies', 'Contacto'].map((label) => (
                <li key={label}>
                  <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} StudyLab. Todos os direitos reservados.
          </p>
          <p className="text-xs text-gray-600">
            Feito em Portugal 🇵🇹 para estudantes universitários
          </p>
        </div>
      </div>
    </footer>
  );
}
