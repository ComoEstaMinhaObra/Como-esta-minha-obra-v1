import Link from "next/link";
import type { Metadata } from "next";
import { listarPosts } from "@/lib/blog";
import { formatarDataBr } from "@/lib/datas";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Artigos sobre acompanhamento de obra, transparência entre empreiteiro e proprietário, e boas práticas sem depender só do WhatsApp.",
  openGraph: {
    title: "Blog · Como Está Minha Obra",
    description:
      "Artigos sobre acompanhamento de obra e transparência entre empreiteiro e proprietário.",
    type: "website",
  },
};

export default function BlogListaPage() {
  const posts = listarPosts();

  return (
    <div className="mx-auto max-w-[800px] px-4 py-16">
      <header className="space-y-3">
        <h1 className="font-serif text-4xl font-light">Blog</h1>
        <p className="text-cinza-2">
          Ideias e práticas para acompanhar a obra com clareza.
        </p>
      </header>

      <ul className="mt-12 space-y-8">
        {posts.length === 0 ? (
          <li className="text-cinza-2">Nenhum post publicado.</li>
        ) : (
          posts.map((p) => (
            <li key={p.slug} className="border-b border-divisor pb-8">
              <p className="text-[10px] uppercase tracking-[0.16em] text-cinza-2">
                {formatarDataBr(p.date)}
              </p>
              <Link
                href={`/blog/${p.slug}`}
                className="mt-2 block font-serif text-2xl font-light text-tinta hover:text-marca"
              >
                {p.title}
              </Link>
              <p className="mt-2 text-sm text-cinza-2">{p.description}</p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
